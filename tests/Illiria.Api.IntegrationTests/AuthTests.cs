using System.Net;
using System.Net.Http.Json;
using Illiria.Api.IntegrationTests.Infrastructure;
using Illiria.Api.Platform.Tenancy;

namespace Illiria.Api.IntegrationTests;

[Collection(MultiTenantCollection.Name)]
public sealed class AuthTests(MultiTenantApiFactory factory) : IAsyncLifetime
{
    public async ValueTask InitializeAsync() => await factory.ResetAsync();

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;

    [Fact]
    public async Task Sign_up_confirms_email_and_starts_a_cookie_session()
    {
        var client = await factory.SignUpAsync("ada@example.com");

        var me = await client.GetMeAsync();

        me.Email.ShouldBe("ada@example.com");
        me.EmailConfirmed.ShouldBeTrue();
        me.TenancyMode.ShouldBe(TenancyMode.Multi);
        me.Organizations.ShouldBeEmpty();
    }

    [Fact]
    public async Task Login_is_refused_until_the_email_is_confirmed()
    {
        var client = factory.CreateBrowserClient();
        await client.PostAsJsonAsync("/api/auth/register", new { email = "bob@example.com", password = TestUsers.Password }, TestContext.Current.CancellationToken);

        var login = await client.PostAsJsonAsync("/api/auth/login?useCookies=true", new { email = "bob@example.com", password = TestUsers.Password }, TestContext.Current.CancellationToken);

        login.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Me_requires_a_session()
    {
        var response = await factory.CreateBrowserClient().GetAsync(new Uri("/api/me", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task State_changing_requests_without_the_csrf_header_are_rejected()
    {
        var client = factory.CreateBrowserClient(withCsrfHeader: false);

        var response = await client.PostAsJsonAsync("/api/auth/register", new { email = "eve@example.com", password = TestUsers.Password }, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Logout_ends_the_session()
    {
        var client = await factory.SignUpAsync("cleo@example.com");

        (await client.PostAsync(new Uri("/api/auth/logout", UriKind.Relative), null, TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (await client.GetAsync(new Uri("/api/me", UriKind.Relative), TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Password_reset_link_points_at_the_web_app()
    {
        await factory.SignUpAsync("dan@example.com");
        var client = factory.CreateBrowserClient();

        (await client.PostAsJsonAsync("/api/auth/forgotPassword", new { email = "dan@example.com" }, TestContext.Current.CancellationToken)).EnsureSuccessStatusCode();
        var link = factory.Emails.Last("dan@example.com", "reset").Link;

        link.GetLeftPart(UriPartial.Path).ShouldBe($"{ApiFactory.PublicUrl}/reset-password");
        var reset = await client.PostAsJsonAsync("/api/auth/resetPassword", new
        {
            email = link.QueryValue("email"),
            resetCode = link.QueryValue("code"),
            newPassword = "An0ther!password",
        }, TestContext.Current.CancellationToken);
        reset.StatusCode.ShouldBe(HttpStatusCode.OK);
        await client.LoginAsync("dan@example.com", "An0ther!password");
    }

    [Fact]
    public async Task Health_endpoints_respond()
    {
        var client = factory.CreateBrowserClient();

        (await client.GetAsync(new Uri("/health/live", UriKind.Relative), TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await client.GetAsync(new Uri("/health/ready", UriKind.Relative), TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.OK);
    }
}
