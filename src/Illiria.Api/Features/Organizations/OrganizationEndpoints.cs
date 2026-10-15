using System.Security.Claims;
using FluentValidation;
using Illiria.Api.Platform.Http;
using Illiria.Api.Platform.Identity;
using Illiria.Api.Platform.Persistence;
using Illiria.Api.Platform.Tenancy;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace Illiria.Api.Features.Organizations;

public sealed record CreateOrganizationRequest(string Name);

public sealed record OrganizationDto(Guid Id, string Name, OrganizationRole Role);

public sealed record MemberDto(Guid UserId, string Email, OrganizationRole Role, DateTimeOffset JoinedAt);

internal sealed class CreateOrganizationRequestValidator : AbstractValidator<CreateOrganizationRequest>
{
    public CreateOrganizationRequestValidator() => RuleFor(r => r.Name).NotEmpty().MaximumLength(100);
}

public static class OrganizationEndpoints
{
    public static IEndpointRouteBuilder MapOrganizationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/orgs", CreateAsync)
            .RequireAuthorization()
            .WithValidation<CreateOrganizationRequest>()
            .WithTags("Organizations")
            .WithName("CreateOrganization");

        var organization = endpoints.MapOrganizationScope().WithTags("Organizations");
        organization.MapGet("", GetAsync).WithName("GetOrganization");
        organization.MapGet("/members", ListMembersAsync).WithName("ListMembers");
        organization.MapDelete("/members/{userId:guid}", RemoveMemberAsync)
            .RequireOrganizationRole(OrganizationRole.Admin)
            .WithName("RemoveMember");

        endpoints.MapInvitationEndpoints(organization);
        return endpoints;
    }

    private static async Task<Results<Created<OrganizationDto>, ProblemHttpResult>> CreateAsync(
        CreateOrganizationRequest request, ClaimsPrincipal principal, TenancyService tenancy, CancellationToken cancellationToken)
    {
        if (tenancy.Mode == TenancyMode.Single)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status403Forbidden, title: "Organizations can't be created in single-tenant mode.");
        }

        var organization = await tenancy.CreateOrganizationAsync(request.Name.Trim(), principal.GetUserId(), cancellationToken);
        return TypedResults.Created($"/api/orgs/{organization.Id}", new OrganizationDto(organization.Id, organization.Name, OrganizationRole.Owner));
    }

    private static async Task<Ok<OrganizationDto>> GetAsync(ICurrentOrganization current, AppDbContext db, CancellationToken cancellationToken)
    {
        var organization = await db.Organizations.SingleAsync(o => o.Id == current.Id, cancellationToken);
        return TypedResults.Ok(new OrganizationDto(organization.Id, organization.Name, current.Role!.Value));
    }

    private static async Task<Ok<List<MemberDto>>> ListMembersAsync(ICurrentOrganization current, AppDbContext db, CancellationToken cancellationToken)
    {
        var members = await db.Memberships
            .Where(m => m.OrganizationId == current.Id)
            .Join(db.Users, m => m.UserId, u => u.Id, (m, u) => new { u.Id, u.Email, m.Role, m.CreatedAt })
            .OrderBy(m => m.Email)
            .Select(m => new MemberDto(m.Id, m.Email!, m.Role, m.CreatedAt))
            .ToListAsync(cancellationToken);
        return TypedResults.Ok(members);
    }

    private static async Task<Results<NoContent, NotFound, ProblemHttpResult>> RemoveMemberAsync(
        Guid userId, ICurrentOrganization current, AppDbContext db, CancellationToken cancellationToken)
    {
        var membership = await db.Memberships.SingleOrDefaultAsync(m => m.OrganizationId == current.Id && m.UserId == userId, cancellationToken);
        if (membership is null)
        {
            return TypedResults.NotFound();
        }

        if (membership.Role == OrganizationRole.Owner)
        {
            if (current.Role != OrganizationRole.Owner)
            {
                return TypedResults.Problem(statusCode: StatusCodes.Status403Forbidden, title: "Only an owner can remove an owner.");
            }

            var owners = await db.Memberships.CountAsync(m => m.OrganizationId == current.Id && m.Role == OrganizationRole.Owner, cancellationToken);
            if (owners <= 1)
            {
                return TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: "An organization must keep at least one owner.");
            }
        }

        db.Memberships.Remove(membership);
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.NoContent();
    }
}
