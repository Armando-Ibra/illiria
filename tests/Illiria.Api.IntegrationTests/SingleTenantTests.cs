using System.Net;
using System.Net.Http.Json;
using Illiria.Api.Features.Organizations;
using Illiria.Api.Features.Projects;
using Illiria.Api.IntegrationTests.Infrastructure;
using Illiria.Api.Platform.Tenancy;

namespace Illiria.Api.IntegrationTests;

[Collection(SingleTenantCollection.Name)]
public sealed class SingleTenantTests(SingleTenantApiFactory factory) : IAsyncLifetime
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync() => await factory.ResetAsync();

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;

    [Fact]
    public async Task Users_join_the_default_organization_and_the_first_one_owns_it()
    {
        var first = await factory.SignUpAsync("first@example.com");
        var second = await factory.SignUpAsync("second@example.com");

        var firstOrganization = (await first.GetMeAsync()).Organizations.ShouldHaveSingleItem();
        var secondOrganization = (await second.GetMeAsync()).Organizations.ShouldHaveSingleItem();

        firstOrganization.Id.ShouldBe(TenancyService.DefaultOrganizationId);
        firstOrganization.Role.ShouldBe(OrganizationRole.Owner);
        secondOrganization.Id.ShouldBe(TenancyService.DefaultOrganizationId);
        secondOrganization.Role.ShouldBe(OrganizationRole.Member);
    }

    [Fact]
    public async Task Users_share_the_default_organizations_data()
    {
        var first = await factory.SignUpAsync("first@example.com");
        var second = await factory.SignUpAsync("second@example.com");
        var projects = $"/api/orgs/{TenancyService.DefaultOrganizationId}/projects";

        await first.PostAsJsonAsync(projects, new SaveProjectRequest("Shared", null), Ct);

        (await second.GetFromJsonAsync<List<ProjectDto>>(projects, Ct))!.ShouldHaveSingleItem().Name.ShouldBe("Shared");
    }

    [Fact]
    public async Task Organizations_cannot_be_created()
    {
        var client = await factory.SignUpAsync("first@example.com");

        var response = await client.PostAsJsonAsync("/api/orgs", new CreateOrganizationRequest("Another"), Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }
}
