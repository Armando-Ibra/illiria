using System.Security.Claims;
using Illiria.Api.Platform;
using Illiria.Api.Platform.Identity;
using Illiria.Api.Platform.Persistence;
using Illiria.Api.Platform.Tenancy;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Illiria.Api.Features.Auth;

public sealed record MyOrganizationDto(Guid Id, string Name, OrganizationRole Role);

public sealed record MeResponse(Guid Id, string Email, bool EmailConfirmed, TenancyMode TenancyMode, IReadOnlyList<MyOrganizationDto> Organizations);

/// <summary>What the web app needs to know before anyone signs in.</summary>
public sealed record AppConfigResponse(TenancyMode TenancyMode, bool RegistrationEnabled);

public static class AuthEndpoints
{
    /// <summary>Documents the parameters <see cref="AuthHardening"/> adds to Identity's endpoints.</summary>
    public static IServiceCollection AddAuthDocumentation(this IServiceCollection services) =>
        services.Configure<Microsoft.AspNetCore.OpenApi.OpenApiOptions>("v1", options => options.AddOperationTransformer((operation, context, _) =>
        {
            if (context.Description.RelativePath == "api/auth/login")
            {
                operation.Parameters ??= [];
                operation.Parameters.Add(new Microsoft.OpenApi.OpenApiParameter
                {
                    Name = "rememberDevice",
                    In = Microsoft.OpenApi.ParameterLocation.Query,
                    Description = "With a 2FA code: don't ask for a code again on this browser.",
                    Schema = new Microsoft.OpenApi.OpenApiSchema { Type = Microsoft.OpenApi.JsonSchemaType.Boolean },
                });
            }

            return Task.CompletedTask;
        }));

    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        // Register, login (?useCookies=true), confirm email, forgot/reset password, 2FA: ASP.NET Core Identity.
        var auth = endpoints.MapGroup("/api/auth")
            .WithTags("Auth")
            .RequireRateLimiting(PlatformExtensions.AuthRateLimitPolicy)
            .AddEndpointFilter(AuthHardening.FilterAsync);
        auth.MapIdentityApi<User>();
        // Deletes the server-side session: a copy of the cookie stops working too.
        auth.MapPost("/logout", async (SignInManager<User> signInManager) =>
            {
                await signInManager.SignOutAsync();
                return TypedResults.NoContent();
            })
            .RequireAuthorization()
            .WithName("Logout");

        endpoints.MapGet("/api/config", (HttpContext http, TenancyService tenancy) =>
                TypedResults.Ok(new AppConfigResponse(tenancy.Mode, AuthHardening.RegistrationEnabled(http))))
            .AllowAnonymous()
            .WithTags("Auth")
            .WithName("GetConfig");

        endpoints.MapGet("/api/me", GetMeAsync).RequireAuthorization().WithTags("Auth").WithName("GetMe");
        return endpoints;
    }

    private static async Task<Results<Ok<MeResponse>, UnauthorizedHttpResult>> GetMeAsync(
        ClaimsPrincipal principal, UserManager<User> users, AppDbContext db, TenancyService tenancy, CancellationToken cancellationToken)
    {
        var user = await users.GetUserAsync(principal);
        if (user is null)
        {
            return TypedResults.Unauthorized();
        }

        var organizations = await db.Memberships
            .Where(m => m.UserId == user.Id)
            .Join(db.Organizations, m => m.OrganizationId, o => o.Id, (m, o) => new { o.Id, o.Name, m.Role })
            .OrderBy(o => o.Name)
            .Select(o => new MyOrganizationDto(o.Id, o.Name, o.Role))
            .ToListAsync(cancellationToken);

        return TypedResults.Ok(new MeResponse(user.Id, user.Email!, user.EmailConfirmed, tenancy.Mode, organizations));
    }
}
