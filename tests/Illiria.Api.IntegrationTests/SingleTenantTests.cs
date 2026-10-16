using System.Net;
using System.Net.Http.Json;
using Illiria.Api.Features.Organizations;
using Illiria.Api.Features.Projects;
using Illiria.Api.IntegrationTests.Infrastructure;
using Illiria.Api.Platform.Tenancy;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;

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
    public async Task An_unconfirmed_sign_up_is_not_a_member()
    {
        var client = factory.CreateBrowserClient();
        await client.PostAsJsonAsync("/api/auth/register", new { email = "early@example.com", password = TestUsers.Password }, Ct);

        await factory.WithDbAsync(async db => (await db.Memberships.CountAsync(Ct)).ShouldBe(0));

        await client.ConfirmEmailAsync(factory, "early@example.com");
        await factory.WithDbAsync(async db => (await db.Memberships.SingleAsync(Ct)).Role.ShouldBe(OrganizationRole.Owner));
    }

    [Fact]
    public async Task The_configured_owner_email_owns_the_default_organization()
    {
        using var configured = factory.WithWebHostBuilder(b => b.UseSetting("Tenancy:OwnerEmail", "boss@example.com"));

        var first = await SignUpAsync(configured, "first@example.com");
        var boss = await SignUpAsync(configured, "boss@example.com");

        (await first.GetMeAsync()).Organizations.ShouldHaveSingleItem().Role.ShouldBe(OrganizationRole.Member);
        (await boss.GetMeAsync()).Organizations.ShouldHaveSingleItem().Role.ShouldBe(OrganizationRole.Owner);
    }

    private async Task<HttpClient> SignUpAsync(Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> host, string email)
    {
        var client = ApiFactory.CreateBrowserClient(host);
        (await client.PostAsJsonAsync("/api/auth/register", new { email, password = TestUsers.Password })).EnsureSuccessStatusCode();
        await client.ConfirmEmailAsync(factory, email);
        await client.LoginAsync(email);
        return client;
    }

    [Fact]
    public async Task Organizations_cannot_be_created()
    {
        var client = await factory.SignUpAsync("first@example.com");

        var response = await client.PostAsJsonAsync("/api/orgs", new CreateOrganizationRequest("Another"), Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }
}
