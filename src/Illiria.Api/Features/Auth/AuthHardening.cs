using System.Text;
using Illiria.Api.Platform.Email;
using Illiria.Api.Platform.Identity;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.Data;
using Microsoft.AspNetCore.WebUtilities;

namespace Illiria.Api.Features.Auth;

/// <summary>
/// Rules layered on top of ASP.NET Core Identity's API endpoints (see ADR 0004). They run as an endpoint filter
/// on /api/auth, so Identity's own handlers stay untouched.
/// </summary>
internal static class AuthHardening
{
    public const string CurrentPasswordHeader = "X-Current-Password";

    public static async ValueTask<object?> FilterAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var http = context.HttpContext;
        var path = http.Request.Path;

        // Cookies only: bearer tokens can't be revoked on logout and no client needs them yet.
        if (path.StartsWithSegments("/api/auth/refresh"))
        {
            return TypedResults.NotFound();
        }

        if (path.StartsWithSegments("/api/auth/login") && !UsesCookies(http.Request))
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Sign in with ?useCookies=true: bearer tokens are disabled.");
        }

        if (path.StartsWithSegments("/api/auth/register") && !RegistrationEnabled(http))
        {
            return TypedResults.NotFound();
        }

        foreach (var argument in context.Arguments)
        {
            var handled = argument switch
            {
                ForgotPasswordRequest request => await SendSetupLinkIfUnconfirmedAsync(http, request.Email),
                ResendConfirmationEmailRequest request => await SendSetupLinkIfUnconfirmedAsync(http, request.Email),
                ResetPasswordRequest request => await ResetUnconfirmedAccountAsync(http, request),
                TwoFactorRequest { Enable: not null } or TwoFactorRequest { ResetSharedKey: true } or TwoFactorRequest { ResetRecoveryCodes: true } =>
                    await RequireCurrentPasswordAsync(http),
                InfoRequest { NewEmail: { Length: > 0 } } => await RequireCurrentPasswordAsync(http),
                _ => null,
            };

            if (handled is not null)
            {
                return handled;
            }
        }

        return await KeepSessionAfterSecurityChangeAsync(http, await next(context));
    }

    public static bool RegistrationEnabled(HttpContext http) =>
        http.RequestServices.GetRequiredService<IConfiguration>().GetValue("Identity:AllowRegistration", true);

    private static bool UsesCookies(HttpRequest request) =>
        bool.TryParse(request.Query["useCookies"], out var cookies) && cookies
        || bool.TryParse(request.Query["useSessionCookies"], out var sessionCookies) && sessionCookies;

    /// <summary>
    /// Pre-registration defense. Someone can register another person's address with a password they know; if the
    /// owner then confirms the address, the stranger can sign in. So for an unconfirmed account, "resend
    /// confirmation" and "forgot password" send a set-password link instead: whoever controls the inbox chooses
    /// the password, and completing it confirms the address. Same response either way (no account enumeration).
    /// </summary>
    private static async Task<IResult?> SendSetupLinkIfUnconfirmedAsync(HttpContext http, string email)
    {
        var users = http.RequestServices.GetRequiredService<UserManager<User>>();
        var user = await users.FindByEmailAsync(email);
        if (user is null || user.EmailConfirmed)
        {
            return null;
        }

        var code = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(await users.GeneratePasswordResetTokenAsync(user)));
        await http.RequestServices.GetRequiredService<IdentityEmailSender>().SendAccountSetupLinkAsync(user.Email!, code);
        return TypedResults.Ok();
    }

    /// <summary>Identity refuses resets for unconfirmed accounts; here a reset is how they get confirmed.</summary>
    private static async Task<IResult?> ResetUnconfirmedAccountAsync(HttpContext http, ResetPasswordRequest request)
    {
        var users = http.RequestServices.GetRequiredService<UserManager<User>>();
        var user = await users.FindByEmailAsync(request.Email);
        if (user is null || user.EmailConfirmed)
        {
            return null;
        }

        string token;
        try
        {
            token = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(request.ResetCode));
        }
        catch (FormatException)
        {
            return InvalidToken(users);
        }

        var reset = await users.ResetPasswordAsync(user, token, request.NewPassword);
        if (!reset.Succeeded)
        {
            return TypedResults.ValidationProblem(reset.Errors.ToDictionary(e => e.Code, e => new[] { e.Description }));
        }

        await users.ConfirmEmailAsync(user, await users.GenerateEmailConfirmationTokenAsync(user));
        return TypedResults.Ok();
    }

    /// <summary>
    /// A session alone (possibly stolen) can't change 2FA or the email: the current password is required too,
    /// sent URL-encoded (encodeURIComponent) in the X-Current-Password header.
    /// </summary>
    private static async Task<IResult?> RequireCurrentPasswordAsync(HttpContext http)
    {
        // URL-encoded by the client: header values must be ASCII, passwords may not be.
        var password = Uri.UnescapeDataString(http.Request.Headers[CurrentPasswordHeader].ToString());
        if (password.Length == 0)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status403Forbidden, title: "Enter your current password to continue.");
        }

        var signIn = http.RequestServices.GetRequiredService<SignInManager<User>>();
        var user = await signIn.UserManager.GetUserAsync(http.User);
        if (user is null)
        {
            return TypedResults.Unauthorized();
        }

        var check = await signIn.CheckPasswordSignInAsync(user, password, lockoutOnFailure: true);
        return check.Succeeded
            ? null
            : TypedResults.Problem(statusCode: StatusCodes.Status403Forbidden, title: "The current password is incorrect.");
    }

    /// <summary>
    /// Changing the password or the 2FA settings rotates the security stamp, which signs out every session,
    /// including the one that made the change (Identity doesn't refresh it). Re-issue the caller's cookie after a
    /// successful change: this device stays signed in, every other session is signed out.
    /// </summary>
    private static async Task<object?> KeepSessionAfterSecurityChangeAsync(HttpContext http, object? result)
    {
        // Identity's handlers return Results<...> unions: the status code is on the wrapped result.
        var outcome = result is INestedHttpResult nested ? nested.Result : result;
        if (HttpMethods.IsPost(http.Request.Method)
            && http.Request.Path.StartsWithSegments("/api/auth/manage")
            && outcome is IStatusCodeHttpResult { StatusCode: >= 200 and < 300 }
            && http.User.Identity is { IsAuthenticated: true, AuthenticationType: var type }
            && type == IdentityConstants.ApplicationScheme)
        {
            var signIn = http.RequestServices.GetRequiredService<SignInManager<User>>();
            var user = await signIn.UserManager.GetUserAsync(http.User);
            if (user is not null)
            {
                await signIn.RefreshSignInAsync(user);
            }
        }

        return result;
    }

    private static ValidationProblem InvalidToken(UserManager<User> users)
    {
        var error = users.ErrorDescriber.InvalidToken();
        return TypedResults.ValidationProblem(new Dictionary<string, string[]> { [error.Code] = [error.Description] });
    }
}
