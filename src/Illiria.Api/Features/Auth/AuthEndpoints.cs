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

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        // Register, login (?useCookies=true), confirm email, forgot/reset password, 2FA: ASP.NET Core Identity.
        var auth = endpoints.MapGroup("/api/auth").WithTags("Auth").RequireRateLimiting(PlatformExtensions.AuthRateLimitPolicy);
        auth.MapIdentityApi<User>();
        auth.MapPost("/logout", async (SignInManager<User> signInManager) =>
            {
                await signInManager.SignOutAsync();
                return TypedResults.NoContent();
            })
            .RequireAuthorization()
            .WithName("Logout");

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
