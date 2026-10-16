using System.Reflection;
using Illiria.Api.Platform.Identity;
using Illiria.Api.Platform.Tenancy;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Illiria.Api.Platform.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options, ICurrentOrganization currentOrganization)
    : IdentityDbContext<User, IdentityRole<Guid>, Guid>(options), IDataProtectionKeyContext
{
    private static readonly MethodInfo ApplyOrganizationFilterMethod =
        typeof(AppDbContext).GetMethod(nameof(ApplyOrganizationFilter), BindingFlags.NonPublic | BindingFlags.Instance)!;

    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<Membership> Memberships => Set<Membership>();
    public DbSet<Invitation> Invitations => Set<Invitation>();

    /// <summary>Read by the query filters at execution time (EF parameterizes context members).</summary>
    private Guid? CurrentOrganizationId => currentOrganization.Id;

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Identity maps its tables explicitly (AspNetUsers, ...); keep the whole schema snake_case.
        builder.Entity<User>().ToTable("users");
        builder.Entity<IdentityRole<Guid>>().ToTable("roles");
        builder.Entity<IdentityUserRole<Guid>>().ToTable("user_roles");
        builder.Entity<IdentityUserClaim<Guid>>().ToTable("user_claims");
        builder.Entity<IdentityUserLogin<Guid>>().ToTable("user_logins");
        builder.Entity<IdentityUserToken<Guid>>().ToTable("user_tokens");
        builder.Entity<IdentityRoleClaim<Guid>>().ToTable("role_claims");

        builder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        foreach (var entityType in builder.Model.GetEntityTypes())
        {
            if (typeof(IOrganizationScoped).IsAssignableFrom(entityType.ClrType))
            {
                ApplyOrganizationFilterMethod.MakeGenericMethod(entityType.ClrType).Invoke(this, [builder]);
            }
        }
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        EnforceOrganizationScope();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        EnforceOrganizationScope();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void ApplyOrganizationFilter<TEntity>(ModelBuilder builder)
        where TEntity : class, IOrganizationScoped
    {
        builder.Entity<TEntity>().HasQueryFilter(QueryFilters.Organization, e => e.OrganizationId == CurrentOrganizationId);
        builder.Entity<TEntity>().HasIndex(e => e.OrganizationId);
    }

    /// <summary>
    /// New rows get the current organization; changes to rows of another organization, or without any
    /// organization context, throw. Inserting with an explicit OrganizationId and no context is allowed
    /// for seeding and background work that sets the id on purpose.
    /// </summary>
    private void EnforceOrganizationScope()
    {
        var current = CurrentOrganizationId;
        foreach (var entry in ChangeTracker.Entries<IOrganizationScoped>())
        {
            switch (entry.State)
            {
                case EntityState.Added when entry.Entity.OrganizationId == Guid.Empty:
                    entry.Entity.OrganizationId = current
                        ?? throw new InvalidOperationException($"Cannot add {entry.Metadata.ClrType.Name} without an organization context.");
                    break;
                case EntityState.Added when current is { } id && entry.Entity.OrganizationId != id:
                    throw new InvalidOperationException($"Cannot add {entry.Metadata.ClrType.Name} to another organization.");
                case EntityState.Modified or EntityState.Deleted:
                    if (current is null || entry.Entity.OrganizationId != current
                        || entry.Property(nameof(IOrganizationScoped.OrganizationId)).IsModified)
                    {
                        throw new InvalidOperationException($"Cannot change {entry.Metadata.ClrType.Name} outside its organization.");
                    }

                    break;
            }
        }
    }
}
