using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using FluentValidation;
using Illiria.Api.Platform.Email;
using Illiria.Api.Platform.Hosting;
using Illiria.Api.Platform.Http;
using Illiria.Api.Platform.Identity;
using Illiria.Api.Platform.Persistence;
using Illiria.Api.Platform.Tenancy;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Illiria.Api.Features.Organizations;

public sealed record CreateInvitationRequest(string Email, OrganizationRole Role);

public sealed record InvitationDto(Guid Id, string Email, OrganizationRole Role, DateTimeOffset ExpiresAt);

public sealed record AcceptInvitationRequest(string Token);

internal sealed class CreateInvitationRequestValidator : AbstractValidator<CreateInvitationRequest>
{
    public CreateInvitationRequestValidator()
    {
        RuleFor(r => r.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(r => r.Role).IsInEnum();
    }
}

internal sealed class AcceptInvitationRequestValidator : AbstractValidator<AcceptInvitationRequest>
{
    public AcceptInvitationRequestValidator() => RuleFor(r => r.Token).NotEmpty().MaximumLength(100);
}

internal static class InvitationEndpoints
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromDays(7);

    public static void MapInvitationEndpoints(this IEndpointRouteBuilder endpoints, RouteGroupBuilder organization)
    {
        organization.MapGet("/invitations", ListAsync)
            .RequireOrganizationRole(OrganizationRole.Admin)
            .WithName("ListInvitations");
        organization.MapPost("/invitations", CreateAsync)
            .RequireOrganizationRole(OrganizationRole.Admin)
            .WithValidation<CreateInvitationRequest>()
            .WithName("CreateInvitation");

        // Outside the organization scope: the invitee is not a member yet.
        endpoints.MapPost("/api/invitations/accept", AcceptAsync)
            .RequireAuthorization()
            .WithValidation<AcceptInvitationRequest>()
            .WithTags("Organizations")
            .WithName("AcceptInvitation");
    }

    private static async Task<Ok<List<InvitationDto>>> ListAsync(
        ICurrentOrganization current, AppDbContext db, TimeProvider time, CancellationToken cancellationToken)
    {
        var now = time.GetUtcNow();
        var invitations = await db.Invitations
            .Where(i => i.OrganizationId == current.Id && i.AcceptedAt == null && i.ExpiresAt > now)
            .OrderBy(i => i.Email)
            .Select(i => new InvitationDto(i.Id, i.Email, i.Role, i.ExpiresAt))
            .ToListAsync(cancellationToken);
        return TypedResults.Ok(invitations);
    }

    private static async Task<Results<Created<InvitationDto>, ProblemHttpResult>> CreateAsync(
        CreateInvitationRequest request,
        ClaimsPrincipal principal,
        ICurrentOrganization current,
        AppDbContext db,
        UserManager<User> users,
        IEmailService email,
        IOptions<AppOptions> app,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        if (request.Role > current.Role)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status403Forbidden, title: "You can't invite with a role higher than your own.");
        }

        var address = request.Email.Trim();
        var normalized = users.NormalizeEmail(address);
        var alreadyMember = await db.Memberships
            .Where(m => m.OrganizationId == current.Id)
            .Join(db.Users, m => m.UserId, u => u.Id, (m, u) => u.NormalizedEmail)
            .AnyAsync(e => e == normalized, cancellationToken);
        if (alreadyMember)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: "This person is already a member.");
        }

        var token = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        var invitation = new Invitation
        {
            OrganizationId = current.Id!.Value,
            Email = address,
            Role = request.Role,
            TokenHash = HashToken(token),
            InvitedByUserId = principal.GetUserId(),
            ExpiresAt = time.GetUtcNow().Add(Lifetime),
        };
        db.Invitations.Add(invitation);
        await db.SaveChangesAsync(cancellationToken);

        var organizationName = await db.Organizations.Where(o => o.Id == current.Id).Select(o => o.Name).SingleAsync(cancellationToken);
        var link = QueryHelpers.AddQueryString(app.Value.PublicUrl.TrimEnd('/') + "/invitations/accept", "token", token);
        await email.SendAsync(
            address,
            $"You're invited to {organizationName}",
            $"<p>You've been invited to join <strong>{WebUtility.HtmlEncode(organizationName)}</strong>. " +
            $"<a href=\"{WebUtility.HtmlEncode(link)}\">Accept the invitation</a> (valid for 7 days).</p>",
            cancellationToken);

        return TypedResults.Created(
            $"/api/orgs/{invitation.OrganizationId}/invitations/{invitation.Id}",
            new InvitationDto(invitation.Id, invitation.Email, invitation.Role, invitation.ExpiresAt));
    }

    private static async Task<Results<Ok<OrganizationDto>, ProblemHttpResult>> AcceptAsync(
        AcceptInvitationRequest request,
        ClaimsPrincipal principal,
        UserManager<User> users,
        AppDbContext db,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        var user = await users.GetUserAsync(principal);
        if (user is null)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status401Unauthorized);
        }

        var now = time.GetUtcNow();
        var hash = HashToken(request.Token);
        var invitation = await db.Invitations.SingleOrDefaultAsync(i => i.TokenHash == hash, cancellationToken);
        if (invitation is null || invitation.AcceptedAt is not null || invitation.ExpiresAt <= now)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status404NotFound, title: "Invitation not found or expired.");
        }

        if (!user.EmailConfirmed || user.NormalizedEmail != users.NormalizeEmail(invitation.Email))
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status403Forbidden, title: "This invitation was sent to a different email address.");
        }

        var membership = await db.Memberships.SingleOrDefaultAsync(
            m => m.OrganizationId == invitation.OrganizationId && m.UserId == user.Id, cancellationToken);
        if (membership is null)
        {
            membership = new Membership { OrganizationId = invitation.OrganizationId, UserId = user.Id, Role = invitation.Role };
            db.Memberships.Add(membership);
        }

        invitation.AcceptedAt = now;
        await db.SaveChangesAsync(cancellationToken);

        var organization = await db.Organizations.SingleAsync(o => o.Id == invitation.OrganizationId, cancellationToken);
        return TypedResults.Ok(new OrganizationDto(organization.Id, organization.Name, membership.Role));
    }

    /// <summary>Only the hash is stored: a database leak doesn't hand out valid invitations.</summary>
    private static string HashToken(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
