using System.Net;
using System.Net.Http.Json;
using Illiria.Api.Features.Projects;
using Illiria.Api.IntegrationTests.Infrastructure;

namespace Illiria.Api.IntegrationTests;

[Collection(MultiTenantCollection.Name)]
public sealed class ProjectTests(MultiTenantApiFactory factory) : IAsyncLifetime
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync() => await factory.ResetAsync();

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;

    [Fact]
    public async Task Projects_can_be_created_read_updated_and_deleted()
    {
        var client = await factory.SignUpAsync("ada@example.com");
        var organization = await client.CreateOrganizationAsync("Acme");
        var projects = $"/api/orgs/{organization.Id}/projects";

        var created = await (await client.PostAsJsonAsync(projects, new SaveProjectRequest("Website", "Relaunch"), Ct)).Content.ReadFromJsonAsync<ProjectDto>(Ct);
        var updated = await client.PutAsJsonAsync($"{projects}/{created!.Id}", new SaveProjectRequest("Website v2", null), Ct);
        updated.StatusCode.ShouldBe(HttpStatusCode.OK);

        var fetched = await client.GetFromJsonAsync<ProjectDto>($"{projects}/{created.Id}", Ct);
        fetched!.Name.ShouldBe("Website v2");
        fetched.Description.ShouldBeNull();

        (await client.DeleteAsync(new Uri($"{projects}/{created.Id}", UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await client.GetAsync(new Uri($"{projects}/{created.Id}", UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Another_organizations_projects_are_invisible_even_by_id()
    {
        var alice = await factory.SignUpAsync("alice@example.com");
        var acme = await alice.CreateOrganizationAsync("Acme");
        var secret = await (await alice.PostAsJsonAsync($"/api/orgs/{acme.Id}/projects", new SaveProjectRequest("Secret", null), Ct)).Content.ReadFromJsonAsync<ProjectDto>(Ct);

        // Bob owns his own organization and uses its id in the route, with Acme's project id.
        var bob = await factory.SignUpAsync("bob@example.com");
        var globex = await bob.CreateOrganizationAsync("Globex");
        var foreign = $"/api/orgs/{globex.Id}/projects/{secret!.Id}";

        (await bob.GetFromJsonAsync<List<ProjectDto>>($"/api/orgs/{globex.Id}/projects", Ct))!.ShouldBeEmpty();
        (await bob.GetAsync(new Uri(foreign, UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await bob.PutAsJsonAsync(foreign, new SaveProjectRequest("Mine now", null), Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await bob.DeleteAsync(new Uri(foreign, UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        (await alice.GetFromJsonAsync<ProjectDto>($"/api/orgs/{acme.Id}/projects/{secret.Id}", Ct))!.Name.ShouldBe("Secret");
    }

    [Fact]
    public async Task Invalid_input_returns_validation_problem()
    {
        var client = await factory.SignUpAsync("ada@example.com");
        var organization = await client.CreateOrganizationAsync("Acme");

        var response = await client.PostAsJsonAsync($"/api/orgs/{organization.Id}/projects", new SaveProjectRequest("", null), Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync(Ct)).ShouldContain("Name");
    }
}
