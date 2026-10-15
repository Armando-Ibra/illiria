using Illiria.Api.Platform.Identity;
using Illiria.Api.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Illiria.Api.Platform.Tenancy;

public sealed record RequiredOrganizationRole(OrganizationRole Role);

/// <summary>
/// The only way a request gets an organization context: the organization id comes from the route and the
/// caller's membership is checked against the database on every request. There is no header or claim override.
/// </summary>
public static class OrganizationScope
{
    public const string RouteParameter = "orgId";

    /// <summary>Maps <c>/api/orgs/{orgId}</c>: authenticated members only; non-members get 404, not 403, so ids don't leak.</summary>
    public static RouteGroupBuilder MapOrganizationScope(this IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);
        return endpoints.MapGroup($"/api/orgs/{{{RouteParameter}:guid}}")
            .RequireAuthorization()
            .AddEndpointFilter(EnterOrganizationAsync)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status403Forbidden);
    }

    /// <summary>Minimum organization role for an endpoint inside <see cref="MapOrganizationScope"/>. Default: Member.</summary>
    public static TBuilder RequireOrganizationRole<TBuilder>(this TBuilder builder, OrganizationRole role)
        where TBuilder : IEndpointConventionBuilder
        => builder.WithMetadata(new RequiredOrganizationRole(role));

    private static async ValueTask<object?> EnterOrganizationAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var http = context.HttpContext;
        if (!Guid.TryParse(http.Request.RouteValues[RouteParameter]?.ToString(), out var organizationId))
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status404NotFound, title: "Organization not found.");
        }

        var userId = http.User.GetUserId();
        var db = http.RequestServices.GetRequiredService<AppDbContext>();
        var role = await db.Memberships
            .Where(m => m.OrganizationId == organizationId && m.UserId == userId)
            .Select(m => (OrganizationRole?)m.Role)
            .SingleOrDefaultAsync(http.RequestAborted);

        if (role is null)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status404NotFound, title: "Organization not found.");
        }

        var required = http.GetEndpoint()?.Metadata.GetMetadata<RequiredOrganizationRole>()?.Role ?? OrganizationRole.Member;
        if (role < required)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status403Forbidden, title: $"This action requires the {required} role.");
        }

        http.RequestServices.GetRequiredService<CurrentOrganization>().Set(organizationId, role.Value);
        return await next(context);
    }
}
