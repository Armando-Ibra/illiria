using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Illiria.Api.Features.Organizations;
using Illiria.Api.Features.Projects;
using Illiria.Api.IntegrationTests.Infrastructure;
using Illiria.Api.Platform.Tenancy;
using Microsoft.AspNetCore.Hosting;

namespace Illiria.Api.IntegrationTests;

[Collection(MultiTenantCollection.Name)]
public sealed class SecurityTests(MultiTenantApiFactory factory) : IAsyncLifetime
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync() => await factory.ResetAsync();

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;

    [Fact]
    public async Task The_session_cookie_is_HttpOnly_Secure_and_SameSite()
    {
        await factory.SignUpAsync("ada@example.com");
        var client = factory.CreateBrowserClient();

        var login = await client.PostAsJsonAsync("/api/auth/login?useCookies=true", new { email = "ada@example.com", password = TestUsers.Password }, Ct);

        var cookie = login.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("illiria.auth=", StringComparison.Ordinal)).ToLowerInvariant();
        cookie.ShouldContain("httponly");
        cookie.ShouldContain("secure");
        cookie.ShouldContain("samesite=lax");
    }

    [Fact]
    public async Task Api_responses_carry_security_headers()
    {
        var response = await factory.CreateBrowserClient().GetAsync(new Uri("/api/me", UriKind.Relative), Ct);

        response.Headers.GetValues("X-Content-Type-Options").ShouldContain("nosniff");
        response.Headers.GetValues("X-Frame-Options").ShouldContain("DENY");
        response.Headers.GetValues("Content-Security-Policy").Single().ShouldContain("default-src 'none'");
    }

    [Theory]
    [InlineData("/openapi/v1.json")]
    [InlineData("/scalar")]
    public async Task Api_documentation_is_not_served_outside_development(string path)
    {
        var response = await factory.CreateBrowserClient().GetAsync(new Uri(path, UriKind.Relative), Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Every_state_changing_verb_requires_the_csrf_header()
    {
        var client = await factory.SignUpAsync("ada@example.com");
        var organization = await client.CreateOrganizationAsync("Acme");
        var project = await (await client.PostAsJsonAsync($"/api/orgs/{organization.Id}/projects", new SaveProjectRequest("P", null), Ct)).Content.ReadFromJsonAsync<ProjectDto>(Ct);
        client.DefaultRequestHeaders.Remove("X-CSRF");
        var projects = $"/api/orgs/{organization.Id}/projects";

        (await client.PostAsJsonAsync(projects, new SaveProjectRequest("Q", null), Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await client.PutAsJsonAsync($"{projects}/{project!.Id}", new SaveProjectRequest("Q", null), Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await client.PatchAsJsonAsync($"{projects}/{project.Id}", new SaveProjectRequest("Q", null), Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await client.DeleteAsync(new Uri($"{projects}/{project.Id}", UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await client.PostAsync(new Uri("/api/auth/logout", UriKind.Relative), null, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        // Nothing changed.
        client.DefaultRequestHeaders.Add("X-CSRF", "1");
        (await client.GetFromJsonAsync<ProjectDto>($"{projects}/{project.Id}", Ct))!.Name.ShouldBe("P");
    }

    [Fact]
    public async Task Repeated_wrong_passwords_lock_the_account()
    {
        await factory.SignUpAsync("ada@example.com");
        var client = factory.CreateBrowserClient();

        for (var attempt = 0; attempt < 5; attempt++)
        {
            await client.PostAsJsonAsync("/api/auth/login?useCookies=true", new { email = "ada@example.com", password = "wrong-password!" }, Ct);
        }

        // Even the right password is refused while the lockout lasts.
        var login = await client.PostAsJsonAsync("/api/auth/login?useCookies=true", new { email = "ada@example.com", password = TestUsers.Password }, Ct);
        login.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await login.Content.ReadAsStringAsync(Ct)).ShouldContain("LockedOut");
    }

    [Fact]
    public async Task Auth_endpoints_are_rate_limited()
    {
        using var limited = factory.WithWebHostBuilder(b => b.UseSetting("RateLimiting:AuthPermitLimit", "3"));
        var client = ApiFactory.CreateBrowserClient(limited);

        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 4; i++)
        {
            statuses.Add((await client.PostAsJsonAsync("/api/auth/login?useCookies=true", new { email = "nobody@example.com", password = "x" }, Ct)).StatusCode);
        }

        statuses[..3].ShouldAllBe(s => s == HttpStatusCode.Unauthorized);
        statuses[3].ShouldBe(HttpStatusCode.TooManyRequests);
    }

    [Fact]
    public async Task Changing_the_password_signs_out_other_sessions()
    {
        var laptop = await factory.SignUpAsync("ada@example.com");
        var phone = factory.CreateBrowserClient();
        await phone.LoginAsync("ada@example.com");

        var change = await laptop.PostAsJsonAsync("/api/auth/manage/info", new { oldPassword = TestUsers.Password, newPassword = "N3w!password-long" }, Ct);
        change.StatusCode.ShouldBe(HttpStatusCode.OK);

        // The device that changed the password stays signed in; the other one is signed out.
        (await laptop.GetAsync(new Uri("/api/me", UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await phone.GetAsync(new Uri("/api/me", UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        await phone.LoginAsync("ada@example.com", "N3w!password-long");
        (await phone.GetAsync(new Uri("/api/me", UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Changing_the_password_requires_the_current_one()
    {
        var client = await factory.SignUpAsync("ada@example.com");

        var change = await client.PostAsJsonAsync("/api/auth/manage/info", new { oldPassword = "not-my-password1", newPassword = "N3w!password-long" }, Ct);

        change.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        await factory.CreateBrowserClient().LoginAsync("ada@example.com");
    }

    [Fact]
    public async Task A_password_reset_signs_out_every_session_and_its_code_works_once()
    {
        var session = await factory.SignUpAsync("ada@example.com");
        var anonymous = factory.CreateBrowserClient();
        await anonymous.PostAsJsonAsync("/api/auth/forgotPassword", new { email = "ada@example.com" }, Ct);
        var code = factory.Emails.Last("ada@example.com", "reset").Link.QueryValue("code");

        var reset = new { email = "ada@example.com", resetCode = code, newPassword = "R3set!password-long" };
        (await anonymous.PostAsJsonAsync("/api/auth/resetPassword", reset, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);

        (await session.GetAsync(new Uri("/api/me", UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await anonymous.PostAsJsonAsync("/api/auth/resetPassword", reset with { newPassword = "Again!password-long" }, Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Forgot_password_does_not_reveal_whether_an_account_exists()
    {
        var client = factory.CreateBrowserClient();

        var unknown = await client.PostAsJsonAsync("/api/auth/forgotPassword", new { email = "nobody@example.com" }, Ct);

        unknown.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Two_factor_login_requires_the_authenticator_code()
    {
        var client = await factory.SignUpAsync("ada@example.com");
        var setup = await (await client.PostAsJsonAsync("/api/auth/manage/2fa", new { }, Ct)).Content.ReadFromJsonAsync<JsonElement>(Ct);
        var sharedKey = setup.GetProperty("sharedKey").GetString()!;
        var enable = await client.PostAsJsonAsync("/api/auth/manage/2fa", new { enable = true, twoFactorCode = Totp.Code(sharedKey) }, Ct);
        enable.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await enable.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("recoveryCodes").GetArrayLength().ShouldBeGreaterThan(0);

        var other = factory.CreateBrowserClient();
        var withoutCode = await other.PostAsJsonAsync("/api/auth/login?useCookies=true", new { email = "ada@example.com", password = TestUsers.Password }, Ct);
        withoutCode.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await withoutCode.Content.ReadAsStringAsync(Ct)).ShouldContain("RequiresTwoFactor");

        var withCode = await other.PostAsJsonAsync("/api/auth/login?useCookies=true", new { email = "ada@example.com", password = TestUsers.Password, twoFactorCode = Totp.Code(sharedKey) }, Ct);
        withCode.StatusCode.ShouldBe(HttpStatusCode.OK);

        // Setting up 2FA didn't sign out the session that did it.
        (await client.GetAsync(new Uri("/api/me", UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Email_links_ignore_a_forged_host_header()
    {
        var client = await factory.SignUpAsync("owner@example.com");
        var organization = await client.CreateOrganizationAsync("Acme");

        using var request = new HttpRequestMessage(HttpMethod.Post, $"/api/orgs/{organization.Id}/invitations")
        {
            Content = JsonContent.Create(new CreateInvitationRequest("victim@example.com", OrganizationRole.Member), options: Json.Options),
        };
        request.Headers.Host = "evil.example";
        (await client.SendAsync(request, Ct)).StatusCode.ShouldBe(HttpStatusCode.Created);

        factory.Emails.Last("victim@example.com", "invited").Link.Host.ShouldBe(new Uri(ApiFactory.PublicUrl).Host);
    }

    [Fact]
    public async Task User_input_is_html_encoded_in_emails()
    {
        var client = await factory.SignUpAsync("owner@example.com");
        var organization = await client.CreateOrganizationAsync("<img src=x onerror=alert(1)>");

        await client.PostAsJsonAsync($"/api/orgs/{organization.Id}/invitations", new CreateInvitationRequest("victim@example.com", OrganizationRole.Member), Json.Options, Ct);

        var html = factory.Emails.Last("victim@example.com", "invited").Html;
        html.ShouldNotContain("<img");
        html.ShouldContain("&lt;img");
    }

    [Theory]
    [InlineData("/api/orgs/not-a-guid/projects")]
    [InlineData("/api/orgs/00000000-0000-0000-0000-000000000000/projects")]
    public async Task Unknown_or_malformed_organization_ids_return_404(string path)
    {
        var client = await factory.SignUpAsync("ada@example.com");

        (await client.GetAsync(new Uri(path, UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Organization_endpoints_require_a_session()
    {
        var owner = await factory.SignUpAsync("owner@example.com");
        var organization = await owner.CreateOrganizationAsync("Acme");

        var anonymous = factory.CreateBrowserClient();

        (await anonymous.GetAsync(new Uri($"/api/orgs/{organization.Id}/projects", UriKind.Relative), Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await anonymous.PostAsJsonAsync("/api/orgs", new CreateOrganizationRequest("X"), Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await anonymous.PostAsJsonAsync("/api/invitations/accept", new AcceptInvitationRequest("x"), Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }
}
