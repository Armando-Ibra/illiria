using System.Net;
using Illiria.Api.Platform.Hosting;
using Illiria.Api.Platform.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;

namespace Illiria.Api.Platform.Email;

/// <summary>
/// Emails sent by the Identity API endpoints. Links always point at the web app's public URL
/// (never at the request host, which the caller controls).
/// </summary>
public sealed partial class IdentityEmailSender(
    IEmailService email,
    IOptions<AppOptions> app,
    ILogger<IdentityEmailSender> logger) : IEmailSender<User>
{
    public Task SendConfirmationLinkAsync(User user, string email, string confirmationLink)
    {
        // Identity builds an API link (HTML-encoded); re-target its query string at the web app's confirm page.
        var apiLink = new Uri(WebUtility.HtmlDecode(confirmationLink));
        var query = QueryHelpers.ParseQuery(apiLink.Query).ToDictionary(kv => kv.Key, kv => (string?)kv.Value.ToString());
        var link = QueryHelpers.AddQueryString(PublicUrl("/confirm-email"), query);
        return SendSafelyAsync(email, "Confirm your email",
            $"<p>Confirm your email address by <a href=\"{WebUtility.HtmlEncode(link)}\">clicking here</a>.</p>");
    }

    public Task SendPasswordResetCodeAsync(User user, string email, string resetCode)
    {
        var link = QueryHelpers.AddQueryString(PublicUrl("/reset-password"), new Dictionary<string, string?>
        {
            ["email"] = email,
            ["code"] = WebUtility.HtmlDecode(resetCode),
        });
        return SendSafelyAsync(email, "Reset your password",
            $"<p>Reset your password by <a href=\"{WebUtility.HtmlEncode(link)}\">clicking here</a>. If you didn't ask for this, ignore this email.</p>");
    }

    public Task SendPasswordResetLinkAsync(User user, string email, string resetLink) =>
        throw new NotSupportedException("The Identity API sends reset codes, not links.");

    private string PublicUrl(string path) => app.Value.PublicUrl.TrimEnd('/') + path;

    /// <summary>
    /// Identity endpoints don't expect sender failures: a failed send would turn a created account into a 500.
    /// Log instead; the user can ask for the email again (/resendConfirmationEmail, /forgotPassword).
    /// </summary>
    private async Task SendSafelyAsync(string to, string subject, string html)
    {
        try
        {
            await email.SendAsync(to, subject, html);
        }
#pragma warning disable CA1031 // Any SMTP failure is logged, never surfaced to the Identity endpoint.
        catch (Exception ex)
#pragma warning restore CA1031
        {
            LogSendFailed(logger, ex, subject);
        }
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Could not send email: {Subject}")]
    private static partial void LogSendFailed(ILogger logger, Exception exception, string subject);
}
