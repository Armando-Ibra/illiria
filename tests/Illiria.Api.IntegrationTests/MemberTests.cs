using System.Net;
using System.Net.Http.Json;
using Illiria.Api.Features.Organizations;
using Illiria.Api.IntegrationTests.Infrastructure;
using Illiria.Api.Platform.Tenancy;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;

namespace Illiria.Api.IntegrationTests;

[Collection(MultiTenantCollection.Name)]
public sealed class MemberTests(MultiTenantApiFactory factory) : IAsyncLifetime
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync() => await factory.ResetAsync();

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;

    [Fact]
    public async Task Owner_can_promote_a_member_who_then_gets_admin_rights()
    {
        var (owner, organization) = await OwnerWithOrganizationAsync();
        var (member, memberId) = await JoinAsync(owner, organization.Id, "member@example.com", OrganizationRole.Member);

        var promoted = await owner.PutAsJsonAsync($"/api/orgs/{organization.Id}/members/{memberId}/role", new ChangeMemberRoleRequest(OrganizationRole.Admin), Json.Options, Ct);

        promoted.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await promoted.Content.ReadFromJsonAsync<MemberDto>(Json.Options, Ct))!.Role.ShouldBe(OrganizationRole.Admin);
        (await member.PostAsJsonAsync($"/api/orgs/{organization.Id}/invitations", new CreateInvitationRequest("new@example.com", OrganizationRole.Member), Json.Options, Ct))
            .StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    [Fact]
    public async Task Roles_cannot_be_escalated()
    {
        var (owner, organization) = await OwnerWithOrganizationAsync();
        var ownerId = (await owner.GetMeAsync()).Id;
        var (admin, adminId) = await JoinAsync(owner, organization.Id, "admin@example.com", OrganizationRole.Admin);
        var (member, memberId) = await JoinAsync(owner, organization.Id, "member@example.com", OrganizationRole.Member);
        var roles = $"/api/orgs/{organization.Id}/members";

        // A member can't change anyone, not even themselves.
        (await member.PutAsJsonAsync($"{roles}/{memberId}/role", new ChangeMemberRoleRequest(OrganizationRole.Admin), Json.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        // An admin can't create owners, promote themselves to owner, or touch an owner.
        (await admin.PutAsJsonAsync($"{roles}/{memberId}/role", new ChangeMemberRoleRequest(OrganizationRole.Owner), Json.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await admin.PutAsJsonAsync($"{roles}/{adminId}/role", new ChangeMemberRoleRequest(OrganizationRole.Owner), Json.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await admin.PutAsJsonAsync($"{roles}/{ownerId}/role", new ChangeMemberRoleRequest(OrganizationRole.Member), Json.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await admin.DeleteAsync(new Uri($"{roles}/{ownerId}", UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        // Out-of-range enum values are rejected by validation.
        (await owner.PutAsJsonAsync($"{roles}/{memberId}/role", new { role = 99 }, Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task An_organization_always_keeps_an_owner()
    {
        var (owner, organization) = await OwnerWithOrganizationAsync();
        var ownerId = (await owner.GetMeAsync()).Id;
        var members = $"/api/orgs/{organization.Id}/members";

        (await owner.PutAsJsonAsync($"{members}/{ownerId}/role", new ChangeMemberRoleRequest(OrganizationRole.Admin), Json.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await owner.PostAsync(new Uri($"/api/orgs/{organization.Id}/leave", UriKind.Relative), null, Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);

        // With a second owner, the first one can step down.
        var (_, secondId) = await JoinAsync(owner, organization.Id, "second@example.com", OrganizationRole.Admin);
        (await owner.PutAsJsonAsync($"{members}/{secondId}/role", new ChangeMemberRoleRequest(OrganizationRole.Owner), Json.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await owner.PutAsJsonAsync($"{members}/{ownerId}/role", new ChangeMemberRoleRequest(OrganizationRole.Member), Json.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task A_member_can_leave_and_loses_access()
    {
        var (owner, organization) = await OwnerWithOrganizationAsync();
        var (member, _) = await JoinAsync(owner, organization.Id, "member@example.com", OrganizationRole.Member);

        (await member.PostAsync(new Uri($"/api/orgs/{organization.Id}/leave", UriKind.Relative), null, Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (await member.GetAsync(new Uri($"/api/orgs/{organization.Id}/projects", UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await member.GetMeAsync()).Organizations.ShouldBeEmpty();
    }

    [Fact]
    public async Task Members_of_another_organization_cannot_be_managed()
    {
        var (alice, acme) = await OwnerWithOrganizationAsync("alice@example.com", "Acme");
        var (bob, globex) = await OwnerWithOrganizationAsync("bob@example.com", "Globex");
        var aliceId = (await alice.GetMeAsync()).Id;

        // Bob is an owner, but of Globex: Alice is not a member there, so she can't be found or changed.
        (await bob.PutAsJsonAsync($"/api/orgs/{globex.Id}/members/{aliceId}/role", new ChangeMemberRoleRequest(OrganizationRole.Member), Json.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await bob.DeleteAsync(new Uri($"/api/orgs/{globex.Id}/members/{aliceId}", UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await bob.DeleteAsync(new Uri($"/api/orgs/{acme.Id}/members/{aliceId}", UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task A_revoked_invitation_stops_working()
    {
        var (owner, organization) = await OwnerWithOrganizationAsync();
        var invitation = await InviteAsync(owner, organization.Id, "late@example.com", OrganizationRole.Member);
        var token = factory.Emails.Last("late@example.com", "invited").Link.QueryValue("token");

        (await owner.DeleteAsync(new Uri($"/api/orgs/{organization.Id}/invitations/{invitation.Id}", UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var invitee = await factory.SignUpAsync("late@example.com");
        (await invitee.PostAsJsonAsync("/api/invitations/accept", new AcceptInvitationRequest(token), Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Invitations_can_only_be_revoked_by_admins_of_their_organization()
    {
        var (owner, organization) = await OwnerWithOrganizationAsync();
        var invitation = await InviteAsync(owner, organization.Id, "pending@example.com", OrganizationRole.Member);
        var (member, _) = await JoinAsync(owner, organization.Id, "member@example.com", OrganizationRole.Member);
        var (stranger, strangersOrganization) = await OwnerWithOrganizationAsync("stranger@example.com", "Globex");

        (await member.DeleteAsync(new Uri($"/api/orgs/{organization.Id}/invitations/{invitation.Id}", UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await stranger.DeleteAsync(new Uri($"/api/orgs/{strangersOrganization.Id}/invitations/{invitation.Id}", UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await owner.GetFromJsonAsync<List<InvitationDto>>($"/api/orgs/{organization.Id}/invitations", Json.Options, Ct))!.ShouldContain(i => i.Id == invitation.Id);
    }

    [Fact]
    public async Task An_expired_invitation_cannot_be_accepted()
    {
        var (owner, organization) = await OwnerWithOrganizationAsync();
        var invitation = await InviteAsync(owner, organization.Id, "slow@example.com", OrganizationRole.Member);
        var token = factory.Emails.Last("slow@example.com", "invited").Link.QueryValue("token");
        await factory.WithDbAsync(db => db.Invitations.Where(i => i.Id == invitation.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(i => i.ExpiresAt, DateTimeOffset.UtcNow.AddMinutes(-1)), Ct));

        var invitee = await factory.SignUpAsync("slow@example.com");

        (await invitee.PostAsJsonAsync("/api/invitations/accept", new AcceptInvitationRequest(token), Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Invitations_of_a_removed_admin_stop_working()
    {
        var (owner, organization) = await OwnerWithOrganizationAsync();
        var (admin, adminId) = await JoinAsync(owner, organization.Id, "admin@example.com", OrganizationRole.Admin);
        await InviteAsync(admin, organization.Id, "accomplice@example.com", OrganizationRole.Admin);
        var token = factory.Emails.Last("accomplice@example.com", "invited").Link.QueryValue("token");

        (await owner.DeleteAsync(new Uri($"/api/orgs/{organization.Id}/members/{adminId}", UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var accomplice = await factory.SignUpAsync("accomplice@example.com");
        (await accomplice.PostAsJsonAsync("/api/invitations/accept", new AcceptInvitationRequest(token), Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await owner.GetFromJsonAsync<List<InvitationDto>>($"/api/orgs/{organization.Id}/invitations", Json.Options, Ct))!.ShouldBeEmpty();
    }

    [Fact]
    public async Task Invitations_of_a_demoted_admin_stop_working()
    {
        var (owner, organization) = await OwnerWithOrganizationAsync();
        var (admin, adminId) = await JoinAsync(owner, organization.Id, "admin@example.com", OrganizationRole.Admin);
        await InviteAsync(admin, organization.Id, "friend@example.com", OrganizationRole.Admin);
        var token = factory.Emails.Last("friend@example.com", "invited").Link.QueryValue("token");

        await owner.PutAsJsonAsync($"/api/orgs/{organization.Id}/members/{adminId}/role", new ChangeMemberRoleRequest(OrganizationRole.Member), Json.Options, Ct);

        var friend = await factory.SignUpAsync("friend@example.com");
        (await friend.PostAsJsonAsync("/api/invitations/accept", new AcceptInvitationRequest(token), Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task An_address_gets_one_pending_invitation_at_a_time()
    {
        var (owner, organization) = await OwnerWithOrganizationAsync();
        await InviteAsync(owner, organization.Id, "twice@example.com", OrganizationRole.Member);

        var again = await owner.PostAsJsonAsync($"/api/orgs/{organization.Id}/invitations", new CreateInvitationRequest("TWICE@example.com", OrganizationRole.Member), Json.Options, Ct);

        again.StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Theory]
    [InlineData("\"IT Security\" <it@example.com>")]
    [InlineData("it@example.com (IT)")]
    [InlineData("not-an-email")]
    public async Task Invitations_need_a_plain_email_address(string email)
    {
        var (owner, organization) = await OwnerWithOrganizationAsync();

        var response = await owner.PostAsJsonAsync($"/api/orgs/{organization.Id}/invitations", new CreateInvitationRequest(email, OrganizationRole.Member), Json.Options, Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Organization_names_cannot_contain_control_characters()
    {
        var client = await factory.SignUpAsync("ada@example.com");

        var response = await client.PostAsJsonAsync("/api/orgs", new CreateOrganizationRequest("Acme\r\nBcc: everyone"), Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Sending_invitations_is_rate_limited_per_user()
    {
        using var limited = factory.WithWebHostBuilder(b => b.UseSetting("RateLimiting:InvitationsPerHour", "2"));
        var owner = ApiFactory.CreateBrowserClient(limited);
        (await owner.PostAsJsonAsync("/api/auth/register", new { email = "owner@example.com", password = TestUsers.Password }, Ct)).EnsureSuccessStatusCode();
        await owner.ConfirmEmailAsync(factory, "owner@example.com");
        await owner.LoginAsync("owner@example.com");
        var organization = await owner.CreateOrganizationAsync("Acme");

        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 3; i++)
        {
            statuses.Add((await owner.PostAsJsonAsync($"/api/orgs/{organization.Id}/invitations", new CreateInvitationRequest($"p{i}@example.com", OrganizationRole.Member), Json.Options, Ct)).StatusCode);
        }

        statuses.ShouldBe([HttpStatusCode.Created, HttpStatusCode.Created, HttpStatusCode.TooManyRequests]);
    }

    [Fact]
    public async Task Outsiders_cannot_list_members_or_invitations()
    {
        var (_, organization) = await OwnerWithOrganizationAsync();
        var stranger = await factory.SignUpAsync("stranger@example.com");

        (await stranger.GetAsync(new Uri($"/api/orgs/{organization.Id}/members", UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await stranger.GetAsync(new Uri($"/api/orgs/{organization.Id}/invitations", UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    private async Task<(HttpClient Client, OrganizationDto Organization)> OwnerWithOrganizationAsync(string email = "owner@example.com", string name = "Acme")
    {
        var client = await factory.SignUpAsync(email);
        return (client, await client.CreateOrganizationAsync(name));
    }

    private static async Task<InvitationDto> InviteAsync(HttpClient inviter, Guid organizationId, string email, OrganizationRole role)
    {
        var response = await inviter.PostAsJsonAsync($"/api/orgs/{organizationId}/invitations", new CreateInvitationRequest(email, role), Json.Options);
        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        return (await response.Content.ReadFromJsonAsync<InvitationDto>(Json.Options))!;
    }

    /// <summary>Invites <paramref name="email"/>, signs them up and accepts: returns their client and user id.</summary>
    private async Task<(HttpClient Client, Guid UserId)> JoinAsync(HttpClient inviter, Guid organizationId, string email, OrganizationRole role)
    {
        await InviteAsync(inviter, organizationId, email, role);
        var token = factory.Emails.Last(email, "invited").Link.QueryValue("token");
        var client = await factory.SignUpAsync(email);
        (await client.PostAsJsonAsync("/api/invitations/accept", new AcceptInvitationRequest(token))).StatusCode.ShouldBe(HttpStatusCode.OK);
        return (client, (await client.GetMeAsync()).Id);
    }
}
