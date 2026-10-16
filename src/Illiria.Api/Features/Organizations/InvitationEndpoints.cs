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
        RuleFor(r => r.Email).NotEmpty().MaximumLength(256)
            .Must(BeAPlainAddress).WithMessage("Enter a plain email address, like name@example.com.");
        RuleFor(r => r.Role).IsInEnum();
    }

    /// <summary>Rejects display-name and comment forms ("Name" &lt;a@b&gt;, a@b (c)): the address must be exactly what was typed.</summary>
    private static bool BeAPlainAddress(string email)
    {
        var trimmed = email?.Trim() ?? "";
        return MimeKit.MailboxAddress.TryParse(trimmed, out var mailbox)
            && mailbox is { Name.Length: 0 }
            && mailbox.Address == trimmed
            && trimmed.Contains('@', StringComparison.Ordinal);
    }
}

internal sealed class AcceptInvitationRequestValidator : AbstractValidator<AcceptInvitationRequest>
{
    public AcceptInvitationRequestValidator() => RuleFor(r => r.Token).NotEmpty().MaximumLength(100);
}

internal static partial class InvitationEndpoints
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromDays(7);
    private const int MaxPendingPerOrganization = 100;

    public static void MapInvitationEndpoints(this IEndpointRouteBuilder endpoints, RouteGroupBuilder organization)
    {
        organization.MapGet("/invitations", ListAsync)
            .RequireOrganizationRole(OrganizationRole.Admin)
            .WithName("ListInvitations");
        organization.MapPost("/invitations", CreateAsync)
            .RequireOrganizationRole(OrganizationRole.Admin)
            .WithValidation<CreateInvitationRequest>()
            .RequireRateLimiting(Platform.PlatformExtensions.InvitationsRateLimitPolicy)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status429TooManyRequests)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable)
            .WithName("CreateInvitation");
        organization.MapDelete("/invitations/{invitationId:guid}", RevokeAsync)
            .RequireOrganizationRole(OrganizationRole.Admin)
            .WithName("RevokeInvitation");

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
        ILoggerFactory loggers,
        CancellationToken cancellationToken)
    {
        var logger = loggers.CreateLogger(nameof(InvitationEndpoints));
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

        var now = time.GetUtcNow();
        var pending = db.Invitations.Where(i => i.OrganizationId == current.Id && i.AcceptedAt == null && i.ExpiresAt > now);
#pragma warning disable CA1862 // Translated to SQL upper(); string.Equals(..., StringComparison) isn't translatable.
        if (await pending.AnyAsync(i => i.Email.ToUpper() == normalized, cancellationToken))
#pragma warning restore CA1862
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: "This address already has a pending invitation.");
        }

        if (await pending.CountAsync(cancellationToken) >= MaxPendingPerOrganization)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: "Too many pending invitations: revoke some first.");
        }

        var token = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        var invitation = new Invitation
        {
            OrganizationId = current.Id!.Value,
            Email = address,
            Role = request.Role,
            TokenHash = HashToken(token),
            InvitedByUserId = principal.GetUserId(),
            ExpiresAt = now.Add(Lifetime),
        };
        db.Invitations.Add(invitation);
        await db.SaveChangesAsync(cancellationToken);

        var organizationName = await db.Organizations.Where(o => o.Id == current.Id).Select(o => o.Name).SingleAsync(cancellationToken);
        var link = QueryHelpers.AddQueryString(app.Value.PublicUrl.TrimEnd('/') + "/invitations/accept", "token", token);
        try
        {
            await email.SendAsync(
                address,
                $"You're invited to {organizationName}",
                $"<p>You've been invited to join <strong>{WebUtility.HtmlEncode(organizationName)}</strong>. " +
                $"<a href=\"{WebUtility.HtmlEncode(link)}\">Accept the invitation</a> (valid for 7 days).</p>",
                cancellationToken);
        }
#pragma warning disable CA1031 // Any send failure: don't keep an invitation nobody received.
        catch (Exception ex) when (ex is not OperationCanceledException)
#pragma warning restore CA1031
        {
            LogInvitationEmailFailed(logger, ex, invitation.Id);
            db.Invitations.Remove(invitation);
            await db.SaveChangesAsync(CancellationToken.None);
            return TypedResults.Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: "The invitation email could not be sent. Try again later.");
        }

        return TypedResults.Created(
            $"/api/orgs/{invitation.OrganizationId}/invitations/{invitation.Id}",
            new InvitationDto(invitation.Id, invitation.Email, invitation.Role, invitation.ExpiresAt));
    }

    /// <summary>Deletes a pending invitation: its link stops working. Accepted invitations are history, not revocable.</summary>
    private static async Task<Results<NoContent, NotFound>> RevokeAsync(
        Guid invitationId, ICurrentOrganization current, AppDbContext db, CancellationToken cancellationToken)
    {
        var deleted = await db.Invitations
            .Where(i => i.Id == invitationId && i.OrganizationId == current.Id && i.AcceptedAt == null)
            .ExecuteDeleteAsync(cancellationToken);
        return deleted == 0 ? TypedResults.NotFound() : TypedResults.NoContent();
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

        // An invitation is only as good as its inviter: if they left, were removed or demoted since, it's void.
        var inviterRole = await db.Memberships
            .Where(m => m.OrganizationId == invitation.OrganizationId && m.UserId == invitation.InvitedByUserId)
            .Select(m => (OrganizationRole?)m.Role)
            .SingleOrDefaultAsync(cancellationToken);
        if (inviterRole is null || inviterRole < OrganizationRole.Admin || inviterRole < invitation.Role)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status404NotFound, title: "Invitation not found or expired.");
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

    [LoggerMessage(Level = LogLevel.Error, Message = "Invitation {InvitationId} email could not be sent; invitation discarded.")]
    private static partial void LogInvitationEmailFailed(ILogger logger, Exception exception, Guid invitationId);

    /// <summary>Only the hash is stored: a database leak doesn't hand out valid invitations.</summary>
    private static string HashToken(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
