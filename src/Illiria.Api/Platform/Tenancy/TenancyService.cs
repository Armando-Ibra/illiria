using Illiria.Api.Platform.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Illiria.Api.Platform.Tenancy;

public sealed class TenancyService(AppDbContext db, IOptions<TenancyOptions> options)
{
    /// <summary>The implicit organization used in <see cref="TenancyMode.Single"/>.</summary>
    public static readonly Guid DefaultOrganizationId = new("01970000-0000-7000-8000-000000000001");

    public TenancyMode Mode => options.Value.Mode;

    public async Task EnsureDefaultOrganizationAsync(CancellationToken cancellationToken = default)
    {
        if (Mode != TenancyMode.Single)
        {
            return;
        }

        if (!await db.Organizations.AnyAsync(o => o.Id == DefaultOrganizationId, cancellationToken))
        {
            db.Organizations.Add(new Organization { Id = DefaultOrganizationId, Name = options.Value.DefaultOrganizationName });
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    /// <summary>
    /// Single mode: a user joins the default organization once their email is confirmed (never before: an
    /// unconfirmed sign-up proves nothing). The Owner is <see cref="TenancyOptions.OwnerEmail"/> when configured,
    /// otherwise the first confirmed user. Serialized with a database lock so two sign-ups can't both become Owner.
    /// </summary>
    internal async Task JoinDefaultOrganizationAsync(Guid userId, string? email, CancellationToken cancellationToken = default)
    {
        if (Mode != TenancyMode.Single)
        {
            return;
        }

        await EnsureDefaultOrganizationAsync(cancellationToken);
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await LockOrganizationAsync(DefaultOrganizationId, cancellationToken);

        if (!await db.Memberships.AnyAsync(m => m.OrganizationId == DefaultOrganizationId && m.UserId == userId, cancellationToken))
        {
            var ownerEmail = options.Value.OwnerEmail;
            var isOwner = string.IsNullOrWhiteSpace(ownerEmail)
                ? !await db.Memberships.AnyAsync(m => m.OrganizationId == DefaultOrganizationId && m.Role == OrganizationRole.Owner, cancellationToken)
                : string.Equals(ownerEmail.Trim(), email, StringComparison.OrdinalIgnoreCase);

            db.Memberships.Add(new Membership
            {
                OrganizationId = DefaultOrganizationId,
                UserId = userId,
                Role = isOwner ? OrganizationRole.Owner : OrganizationRole.Member,
            });
            await db.SaveChangesAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
    }

    public async Task<Organization> CreateOrganizationAsync(string name, Guid ownerId, CancellationToken cancellationToken = default)
    {
        var organization = new Organization { Name = name };
        db.Organizations.Add(organization);
        db.Memberships.Add(new Membership { OrganizationId = organization.Id, UserId = ownerId, Role = OrganizationRole.Owner });
        await db.SaveChangesAsync(cancellationToken);
        return organization;
    }

    /// <summary>
    /// Serializes membership changes of one organization until the current transaction ends (Postgres advisory
    /// lock), so checks like "is this the last owner?" can't race. Call inside a transaction.
    /// </summary>
    public Task LockOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default) =>
        db.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock(hashtextextended({organizationId.ToString()}, 0))", cancellationToken);
}
