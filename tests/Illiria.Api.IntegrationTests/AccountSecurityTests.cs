using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Illiria.Api.Features.Auth;
using Illiria.Api.Features.Projects;
using Illiria.Api.IntegrationTests.Infrastructure;
using Illiria.Api.Platform.Tenancy;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;

namespace Illiria.Api.IntegrationTests;

/// <summary>Regression tests for the findings of the security review (sessions, account takeover, 2FA, input).</summary>
[Collection(MultiTenantCollection.Name)]
public sealed class AccountSecurityTests(MultiTenantApiFactory factory) : IAsyncLifetime
{
    private const string StrongPassword = "An0ther!password";
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync() => await factory.ResetAsync();

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;

    [Fact]
    public async Task Logout_revokes_the_session_even_for_a_copied_cookie()
    {
        await factory.SignUpAsync("ada@example.com");
        var browser = factory.CreateBrowserClient();
        var login = await browser.PostAsJsonAsync("/api/auth/login?useCookies=true", new { email = "ada@example.com", password = TestUsers.Password }, Ct);
        var cookie = login.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("illiria.auth=", StringComparison.Ordinal)).Split(';')[0];

        (await browser.PostAsync(new Uri("/api/auth/logout", UriKind.Relative), null, Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var thief = factory.CreateClient(new() { BaseAddress = new Uri("https://localhost"), HandleCookies = false });
        thief.DefaultRequestHeaders.Add("Cookie", cookie);
        (await thief.GetAsync(new Uri("/api/me", UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Changing_two_factor_settings_requires_the_current_password()
    {
        var client = await factory.SignUpAsync("ada@example.com");
        var setup = await (await client.PostAsJsonAsync("/api/auth/manage/2fa", new { }, Ct)).Content.ReadFromJsonAsync<JsonElement>(Ct);
        var enable = new { enable = true, twoFactorCode = Totp.Code(setup.GetProperty("sharedKey").GetString()!) };

        // A session alone (e.g. a stolen cookie) can't turn 2FA on and lock the owner out.
        (await client.PostAsJsonAsync("/api/auth/manage/2fa", enable, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        client.DefaultRequestHeaders.Add("X-Current-Password", Uri.EscapeDataString("wrong-password!1"));
        (await client.PostAsJsonAsync("/api/auth/manage/2fa", enable, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        client.DefaultRequestHeaders.Remove("X-Current-Password");
        client.DefaultRequestHeaders.Add("X-Current-Password", Uri.EscapeDataString(TestUsers.Password));
        (await client.PostAsJsonAsync("/api/auth/manage/2fa", enable, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await client.PostAsJsonAsync("/api/auth/manage/2fa", new { enable = false }, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Non_ascii_current_passwords_work_when_url_encoded()
    {
        const string password = "Пароль-1234!Xyz";
        var client = factory.CreateBrowserClient();
        var registered = await client.PostAsJsonAsync("/api/auth/register", new { email = "ivan@example.com", password }, Ct);
        registered.StatusCode.ShouldBe(HttpStatusCode.OK, await registered.Content.ReadAsStringAsync(Ct));
        await client.ConfirmEmailAsync(factory, "ivan@example.com");
        await client.LoginAsync("ivan@example.com", password);
        client.DefaultRequestHeaders.Add("X-Current-Password", Uri.EscapeDataString(password));

        (await client.PostAsJsonAsync("/api/auth/manage/2fa", new { resetRecoveryCodes = true }, Ct)).StatusCode.ShouldNotBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Changing_the_email_requires_the_current_password()
    {
        var client = await factory.SignUpAsync("ada@example.com");

        (await client.PostAsJsonAsync("/api/auth/manage/info", new { newEmail = "attacker@example.com" }, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        factory.Emails.Sent.ShouldNotContain(e => e.Recipient == "attacker@example.com");

        client.DefaultRequestHeaders.Add("X-Current-Password", Uri.EscapeDataString(TestUsers.Password));
        (await client.PostAsJsonAsync("/api/auth/manage/info", new { newEmail = "ada.new@example.com" }, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    /// <summary>
    /// Pre-registration takeover: an attacker registers the victim's address with a password they know. When the
    /// victim asks for help, they get a set-password link: the attacker's password stops working.
    /// </summary>
    [Fact]
    public async Task A_squatted_unconfirmed_account_is_recovered_by_its_email_owner()
    {
        var attacker = factory.CreateBrowserClient();
        (await attacker.PostAsJsonAsync("/api/auth/register", new { email = "victim@example.com", password = "Attacker!password1" }, Ct)).EnsureSuccessStatusCode();

        var victim = factory.CreateBrowserClient();
        (await victim.PostAsJsonAsync("/api/auth/register", new { email = "victim@example.com", password = TestUsers.Password }, Ct))
            .StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await victim.PostAsJsonAsync("/api/auth/forgotPassword", new { email = "victim@example.com" }, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var link = factory.Emails.Last("victim@example.com", "setting up").Link;
        link.GetLeftPart(UriPartial.Path).ShouldBe($"{ApiFactory.PublicUrl}/reset-password");

        var reset = await victim.PostAsJsonAsync("/api/auth/resetPassword", new { email = "victim@example.com", resetCode = link.QueryValue("code"), newPassword = StrongPassword }, Ct);
        reset.StatusCode.ShouldBe(HttpStatusCode.OK);

        await victim.LoginAsync("victim@example.com", StrongPassword);
        (await victim.GetMeAsync()).EmailConfirmed.ShouldBeTrue();
        (await attacker.PostAsJsonAsync("/api/auth/login?useCookies=true", new { email = "victim@example.com", password = "Attacker!password1" }, Ct))
            .StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Resending_the_confirmation_of_an_unconfirmed_account_sends_a_set_password_link()
    {
        var client = factory.CreateBrowserClient();
        await client.PostAsJsonAsync("/api/auth/register", new { email = "slow@example.com", password = TestUsers.Password }, Ct);

        (await client.PostAsJsonAsync("/api/auth/resendConfirmationEmail", new { email = "slow@example.com" }, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);

        factory.Emails.Last("slow@example.com", "setting up").Link.AbsolutePath.ShouldBe("/reset-password");
    }

    [Fact]
    public async Task Bearer_tokens_are_disabled()
    {
        await factory.SignUpAsync("ada@example.com");
        var client = factory.CreateBrowserClient();

        (await client.PostAsJsonAsync("/api/auth/login", new { email = "ada@example.com", password = TestUsers.Password }, Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await client.PostAsJsonAsync("/api/auth/refresh", new { refreshToken = "x" }, Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Public_config_reports_tenancy_and_registration()
    {
        var config = await factory.CreateBrowserClient().GetFromJsonAsync<AppConfigResponse>("/api/config", Json.Options, Ct);

        config!.TenancyMode.ShouldBe(TenancyMode.Multi);
        config.RegistrationEnabled.ShouldBeTrue();
    }

    [Fact]
    public async Task Registration_can_be_turned_off()
    {
        using var inviteOnly = factory.WithWebHostBuilder(b => b.UseSetting("Identity:AllowRegistration", "false"));
        var client = ApiFactory.CreateBrowserClient(inviteOnly);

        (await client.PostAsJsonAsync("/api/auth/register", new { email = "ada@example.com", password = TestUsers.Password }, Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await client.GetFromJsonAsync<AppConfigResponse>("/api/config", Json.Options, Ct))!.RegistrationEnabled.ShouldBeFalse();
    }

    [Fact]
    public async Task Oversized_or_malformed_input_is_a_client_error_not_a_crash()
    {
        var client = factory.CreateBrowserClient();

        var longEmail = new string('a', 300) + "@example.com";
        (await client.PostAsJsonAsync("/api/auth/register", new { email = longEmail, password = TestUsers.Password }, Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await client.GetAsync(new Uri("/api/auth/confirmEmail?userId=zzz&code=abc", UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Queries_without_an_organization_context_see_and_delete_nothing()
    {
        var client = await factory.SignUpAsync("ada@example.com");
        var organization = await client.CreateOrganizationAsync("Acme");
        await client.PostAsJsonAsync($"/api/orgs/{organization.Id}/projects", new SaveProjectRequest("Keep me", null), Ct);

        // Outside an organization-scoped request (e.g. a background job that forgot to set one): fail closed.
        await factory.WithDbAsync(async db =>
        {
            (await db.Set<Project>().CountAsync(Ct)).ShouldBe(0);
            (await db.Set<Project>().ExecuteDeleteAsync(Ct)).ShouldBe(0);
        });

        (await client.GetFromJsonAsync<List<ProjectDto>>($"/api/orgs/{organization.Id}/projects", Ct))!.ShouldHaveSingleItem();
    }
}
