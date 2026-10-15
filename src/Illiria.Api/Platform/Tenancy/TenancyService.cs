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

    internal async Task OnUserCreatedAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        if (Mode != TenancyMode.Single)
        {
            return;
        }

        await EnsureDefaultOrganizationAsync(cancellationToken);
        var hasMembers = await db.Memberships.AnyAsync(m => m.OrganizationId == DefaultOrganizationId, cancellationToken);
        db.Memberships.Add(new Membership
        {
            OrganizationId = DefaultOrganizationId,
            UserId = userId,
            Role = hasMembers ? OrganizationRole.Member : OrganizationRole.Owner,
        });
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<Organization> CreateOrganizationAsync(string name, Guid ownerId, CancellationToken cancellationToken = default)
    {
        var organization = new Organization { Name = name };
        db.Organizations.Add(organization);
        db.Memberships.Add(new Membership { OrganizationId = organization.Id, UserId = ownerId, Role = OrganizationRole.Owner });
        await db.SaveChangesAsync(cancellationToken);
        return organization;
    }
}
