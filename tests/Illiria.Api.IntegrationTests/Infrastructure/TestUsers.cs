using System.Net;
using System.Net.Http.Json;
using Illiria.Api.Features.Auth;
using Microsoft.AspNetCore.WebUtilities;

namespace Illiria.Api.IntegrationTests.Infrastructure;

public static class TestUsers
{
    public const string Password = "Passw0rd!long";

    /// <summary>Registers, confirms the email through the link that was sent, and logs in with a cookie.</summary>
    public static async Task<HttpClient> SignUpAsync(this ApiFactory factory, string email)
    {
        var client = factory.CreateBrowserClient();
        (await client.PostAsJsonAsync("/api/auth/register", new { email, password = Password })).EnsureSuccessStatusCode();
        await client.ConfirmEmailAsync(factory, email);
        await client.LoginAsync(email);
        return client;
    }

    public static async Task ConfirmEmailAsync(this HttpClient client, ApiFactory factory, string email)
    {
        // The email links to the web app; the web app forwards the query string to the API.
        var link = factory.Emails.Last(email, "confirm").Link;
        link.GetLeftPart(UriPartial.Path).ShouldBe($"{ApiFactory.PublicUrl}/confirm-email");
        var confirm = await client.GetAsync(new Uri("/api/auth/confirmEmail" + link.Query, UriKind.Relative));
        confirm.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    public static async Task LoginAsync(this HttpClient client, string email, string password = Password)
    {
        var login = await client.PostAsJsonAsync("/api/auth/login?useCookies=true", new { email, password });
        login.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    public static async Task<MeResponse> GetMeAsync(this HttpClient client) =>
        (await client.GetFromJsonAsync<MeResponse>("/api/me", Json.Options))!;

    public static string QueryValue(this Uri uri, string key) => QueryHelpers.ParseQuery(uri.Query)[key].ToString();
}
