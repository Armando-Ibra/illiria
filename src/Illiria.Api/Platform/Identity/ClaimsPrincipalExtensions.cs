using System.Security.Claims;

namespace Illiria.Api.Platform.Identity;

public static class ClaimsPrincipalExtensions
{
    /// <summary>The authenticated user's id. Only call on endpoints that require authorization.</summary>
    public static Guid GetUserId(this ClaimsPrincipal principal)
    {
        ArgumentNullException.ThrowIfNull(principal);
        var value = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(value, out var id)
            ? id
            : throw new InvalidOperationException("The current principal has no user id claim.");
    }
}
