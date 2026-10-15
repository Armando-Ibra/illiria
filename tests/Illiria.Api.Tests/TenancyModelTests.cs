using Illiria.Api.Features.Projects;
using Illiria.Api.Platform.Persistence;
using Illiria.Api.Platform.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace Illiria.Api.Tests;

public sealed class TenancyModelTests
{
    [Fact]
    public void Every_entity_is_organization_scoped_or_explicitly_global()
    {
        using var db = CreateContext(new CurrentOrganization());

        var unclassified = db.Model.GetEntityTypes()
            .Select(e => e.ClrType)
            .Where(t => t.Namespace?.StartsWith("Illiria.", StringComparison.Ordinal) == true)
            .Where(t => !typeof(IOrganizationScoped).IsAssignableFrom(t))
            .Where(t => t.GetCustomAttributes(typeof(GlobalEntityAttribute), inherit: false).Length == 0)
            .Select(t => t.Name)
            .ToList();

        unclassified.ShouldBeEmpty("Implement IOrganizationScoped, or mark the entity [GlobalEntity(\"why\")].");
    }

    [Fact]
    public void Every_organization_scoped_entity_has_the_organization_filter()
    {
        using var db = CreateContext(new CurrentOrganization());

        var scoped = db.Model.GetEntityTypes().Where(e => typeof(IOrganizationScoped).IsAssignableFrom(e.ClrType)).ToList();

        scoped.ShouldNotBeEmpty();
        foreach (var entityType in scoped)
        {
            entityType.GetDeclaredQueryFilters().Select(f => f.Key).ShouldContain(QueryFilters.Organization, entityType.ClrType.Name);
        }
    }

    [Fact]
    public async Task Adding_a_scoped_entity_without_an_organization_context_throws()
    {
        await using var db = CreateContext(new CurrentOrganization());
        db.Add(new Project { Name = "orphan" });

        await Should.ThrowAsync<InvalidOperationException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public async Task Adding_a_scoped_entity_to_another_organization_throws()
    {
        var current = new CurrentOrganization();
        current.Set(Guid.NewGuid(), OrganizationRole.Owner);
        await using var db = CreateContext(current);
        db.Add(new Project { Name = "elsewhere", OrganizationId = Guid.NewGuid() });

        await Should.ThrowAsync<InvalidOperationException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public async Task Changing_a_row_of_another_organization_throws()
    {
        var current = new CurrentOrganization();
        current.Set(Guid.NewGuid(), OrganizationRole.Owner);
        await using var db = CreateContext(current);
        var foreign = new Project { Name = "foreign", OrganizationId = Guid.NewGuid() };
        db.Attach(foreign);
        foreign.Name = "changed";

        await Should.ThrowAsync<InvalidOperationException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public void The_current_organization_cannot_be_switched_within_a_scope()
    {
        var current = new CurrentOrganization();
        current.Set(Guid.NewGuid(), OrganizationRole.Member);

        Should.Throw<InvalidOperationException>(() => current.Set(Guid.NewGuid(), OrganizationRole.Member));
    }

    // Builds the real model; the connection string is never opened because every case fails before I/O.
    private static AppDbContext CreateContext(ICurrentOrganization current) =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=unused;Database=unused")
            .UseSnakeCaseNamingConvention()
            .Options, current);
}
