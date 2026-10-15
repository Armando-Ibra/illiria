using System.Net;
using System.Net.Http.Json;
using Illiria.Api.Features.Organizations;
using Illiria.Api.Features.Projects;
using Illiria.Api.IntegrationTests.Infrastructure;
using Illiria.Api.Platform.Tenancy;

namespace Illiria.Api.IntegrationTests;

[Collection(MultiTenantCollection.Name)]
public sealed class OrganizationTests(MultiTenantApiFactory factory) : IAsyncLifetime
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync() => await factory.ResetAsync();

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;

    [Fact]
    public async Task Creator_becomes_owner()
    {
        var owner = await factory.SignUpAsync("owner@example.com");

        var organization = await owner.CreateOrganizationAsync("Acme");

        organization.Role.ShouldBe(OrganizationRole.Owner);
        (await owner.GetMeAsync()).Organizations.ShouldContain(o => o.Id == organization.Id && o.Role == OrganizationRole.Owner);
        var members = await owner.GetFromJsonAsync<List<MemberDto>>($"/api/orgs/{organization.Id}/members", Json.Options, Ct);
        members!.Single().Email.ShouldBe("owner@example.com");
    }

    [Fact]
    public async Task Non_members_get_404_not_403()
    {
        var owner = await factory.SignUpAsync("owner@example.com");
        var stranger = await factory.SignUpAsync("stranger@example.com");
        var organization = await owner.CreateOrganizationAsync("Acme");

        (await stranger.GetAsync(new Uri($"/api/orgs/{organization.Id}", UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await stranger.GetAsync(new Uri($"/api/orgs/{organization.Id}/projects", UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Invited_member_joins_with_the_invited_role()
    {
        var owner = await factory.SignUpAsync("owner@example.com");
        var organization = await owner.CreateOrganizationAsync("Acme");
        await owner.PostAsJsonAsync($"/api/orgs/{organization.Id}/projects", new SaveProjectRequest("Roadmap", null), Ct);

        (await owner.PostAsJsonAsync($"/api/orgs/{organization.Id}/invitations", new CreateInvitationRequest("member@example.com", OrganizationRole.Member), Json.Options, Ct))
            .StatusCode.ShouldBe(HttpStatusCode.Created);
        var token = factory.Emails.Last("member@example.com", "invited").Link.QueryValue("token");

        var member = await factory.SignUpAsync("member@example.com");
        var accepted = await member.PostAsJsonAsync("/api/invitations/accept", new AcceptInvitationRequest(token), Ct);

        accepted.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await member.GetMeAsync()).Organizations.ShouldContain(o => o.Id == organization.Id && o.Role == OrganizationRole.Member);
        var projects = await member.GetFromJsonAsync<List<ProjectDto>>($"/api/orgs/{organization.Id}/projects", Json.Options, Ct);
        projects!.Single().Name.ShouldBe("Roadmap");

        // Members can't do admin things.
        (await member.DeleteAsync(new Uri($"/api/orgs/{organization.Id}/projects/{projects![0].Id}", UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await member.PostAsJsonAsync($"/api/orgs/{organization.Id}/invitations", new CreateInvitationRequest("x@example.com", OrganizationRole.Member), Json.Options, Ct))
            .StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task An_invitation_only_works_for_the_invited_email_and_only_once()
    {
        var owner = await factory.SignUpAsync("owner@example.com");
        var organization = await owner.CreateOrganizationAsync("Acme");
        await owner.PostAsJsonAsync($"/api/orgs/{organization.Id}/invitations", new CreateInvitationRequest("invited@example.com", OrganizationRole.Admin), Json.Options, Ct);
        var token = factory.Emails.Last("invited@example.com", "invited").Link.QueryValue("token");

        var other = await factory.SignUpAsync("other@example.com");
        (await other.PostAsJsonAsync("/api/invitations/accept", new AcceptInvitationRequest(token), Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        var invited = await factory.SignUpAsync("invited@example.com");
        (await invited.PostAsJsonAsync("/api/invitations/accept", new AcceptInvitationRequest(token), Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await invited.PostAsJsonAsync("/api/invitations/accept", new AcceptInvitationRequest(token), Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Admins_cannot_invite_owners()
    {
        var owner = await factory.SignUpAsync("owner@example.com");
        var organization = await owner.CreateOrganizationAsync("Acme");
        await owner.PostAsJsonAsync($"/api/orgs/{organization.Id}/invitations", new CreateInvitationRequest("admin@example.com", OrganizationRole.Admin), Json.Options, Ct);
        var admin = await factory.SignUpAsync("admin@example.com");
        await admin.PostAsJsonAsync("/api/invitations/accept", new AcceptInvitationRequest(factory.Emails.Last("admin@example.com", "invited").Link.QueryValue("token")), Ct);

        var response = await admin.PostAsJsonAsync($"/api/orgs/{organization.Id}/invitations", new CreateInvitationRequest("boss@example.com", OrganizationRole.Owner), Json.Options, Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task The_last_owner_cannot_be_removed()
    {
        var owner = await factory.SignUpAsync("owner@example.com");
        var organization = await owner.CreateOrganizationAsync("Acme");
        var me = await owner.GetMeAsync();

        var response = await owner.DeleteAsync(new Uri($"/api/orgs/{organization.Id}/members/{me.Id}", UriKind.Relative), Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }
}

internal static class OrganizationClient
{
    public static async Task<OrganizationDto> CreateOrganizationAsync(this HttpClient client, string name)
    {
        var response = await client.PostAsJsonAsync("/api/orgs", new CreateOrganizationRequest(name));
        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        return (await response.Content.ReadFromJsonAsync<OrganizationDto>(Json.Options))!;
    }
}
