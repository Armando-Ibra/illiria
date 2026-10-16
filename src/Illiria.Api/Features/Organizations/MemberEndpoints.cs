using System.Security.Claims;
using FluentValidation;
using Illiria.Api.Platform.Http;
using Illiria.Api.Platform.Identity;
using Illiria.Api.Platform.Persistence;
using Illiria.Api.Platform.Tenancy;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace Illiria.Api.Features.Organizations;

public sealed record MemberDto(Guid UserId, string Email, OrganizationRole Role, DateTimeOffset JoinedAt);

public sealed record ChangeMemberRoleRequest(OrganizationRole Role);

internal sealed class ChangeMemberRoleRequestValidator : AbstractValidator<ChangeMemberRoleRequest>
{
    public ChangeMemberRoleRequestValidator() => RuleFor(r => r.Role).IsInEnum();
}

/// <summary>
/// Role rules: nobody grants a role above their own; only an owner can change or remove an owner;
/// an organization always keeps at least one owner.
/// </summary>
internal static class MemberEndpoints
{
    public static void MapMemberEndpoints(this RouteGroupBuilder organization)
    {
        organization.MapGet("/members", ListAsync).WithName("ListMembers");
        organization.MapPut("/members/{userId:guid}/role", ChangeRoleAsync)
            .RequireOrganizationRole(OrganizationRole.Admin)
            .WithValidation<ChangeMemberRoleRequest>()
            .ProducesProblem(StatusCodes.Status409Conflict)
            .WithName("ChangeMemberRole");
        organization.MapDelete("/members/{userId:guid}", RemoveAsync)
            .RequireOrganizationRole(OrganizationRole.Admin)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .WithName("RemoveMember");
        organization.MapPost("/leave", LeaveAsync)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .WithName("LeaveOrganization");
    }

    private static async Task<Ok<List<MemberDto>>> ListAsync(ICurrentOrganization current, AppDbContext db, CancellationToken cancellationToken)
    {
        var members = await db.Memberships
            .Where(m => m.OrganizationId == current.Id)
            .Join(db.Users, m => m.UserId, u => u.Id, (m, u) => new { u.Id, u.Email, m.Role, m.CreatedAt })
            .OrderBy(m => m.Email)
            .Select(m => new MemberDto(m.Id, m.Email!, m.Role, m.CreatedAt))
            .ToListAsync(cancellationToken);
        return TypedResults.Ok(members);
    }

    private static async Task<Results<Ok<MemberDto>, NotFound, ProblemHttpResult>> ChangeRoleAsync(
        Guid userId, ChangeMemberRoleRequest request, ICurrentOrganization current, AppDbContext db, TenancyService tenancy, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await tenancy.LockOrganizationAsync(current.Id!.Value, cancellationToken);
        var membership = await FindAsync(db, current, userId, cancellationToken);
        if (membership is null)
        {
            return TypedResults.NotFound();
        }

        if (request.Role > current.Role)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status403Forbidden, title: "You can't grant a role higher than your own.");
        }

        if (membership.Role == OrganizationRole.Owner && current.Role != OrganizationRole.Owner)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status403Forbidden, title: "Only an owner can change an owner's role.");
        }

        if (membership.Role == OrganizationRole.Owner && request.Role != OrganizationRole.Owner
            && await IsLastOwnerAsync(db, current, cancellationToken))
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: "An organization must keep at least one owner.");
        }

        membership.Role = request.Role;
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var email = await db.Users.Where(u => u.Id == userId).Select(u => u.Email!).SingleAsync(cancellationToken);
        return TypedResults.Ok(new MemberDto(userId, email, membership.Role, membership.CreatedAt));
    }

    private static async Task<Results<NoContent, NotFound, ProblemHttpResult>> RemoveAsync(
        Guid userId, ICurrentOrganization current, AppDbContext db, TenancyService tenancy, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await tenancy.LockOrganizationAsync(current.Id!.Value, cancellationToken);
        var membership = await FindAsync(db, current, userId, cancellationToken);
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

            if (await IsLastOwnerAsync(db, current, cancellationToken))
            {
                return TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: "An organization must keep at least one owner.");
            }
        }

        await RemoveMembershipAsync(db, membership, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return TypedResults.NoContent();
    }

    /// <summary>Any member can leave, except the last owner (who must hand ownership over first).</summary>
    private static async Task<Results<NoContent, ProblemHttpResult>> LeaveAsync(
        ClaimsPrincipal principal, ICurrentOrganization current, AppDbContext db, TenancyService tenancy, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await tenancy.LockOrganizationAsync(current.Id!.Value, cancellationToken);
        var membership = (await FindAsync(db, current, principal.GetUserId(), cancellationToken))!;
        if (membership.Role == OrganizationRole.Owner && await IsLastOwnerAsync(db, current, cancellationToken))
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: "Make someone else an owner before leaving.");
        }

        await RemoveMembershipAsync(db, membership, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return TypedResults.NoContent();
    }

    /// <summary>Also drops the pending invitations they sent: those would otherwise outlive their access.</summary>
    private static async Task RemoveMembershipAsync(AppDbContext db, Membership membership, CancellationToken cancellationToken)
    {
        db.Memberships.Remove(membership);
        await db.SaveChangesAsync(cancellationToken);
        await db.Invitations
            .Where(i => i.OrganizationId == membership.OrganizationId && i.InvitedByUserId == membership.UserId && i.AcceptedAt == null)
            .ExecuteDeleteAsync(cancellationToken);
    }

    private static Task<Membership?> FindAsync(AppDbContext db, ICurrentOrganization current, Guid userId, CancellationToken cancellationToken) =>
        db.Memberships.SingleOrDefaultAsync(m => m.OrganizationId == current.Id && m.UserId == userId, cancellationToken);

    private static async Task<bool> IsLastOwnerAsync(AppDbContext db, ICurrentOrganization current, CancellationToken cancellationToken) =>
        await db.Memberships.CountAsync(m => m.OrganizationId == current.Id && m.Role == OrganizationRole.Owner, cancellationToken) <= 1;
}
