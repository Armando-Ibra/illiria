using System.Collections.Concurrent;
using System.Net;
using System.Text.RegularExpressions;
using Illiria.Api.Platform.Email;

namespace Illiria.Api.IntegrationTests.Infrastructure;

public sealed record SentEmail(string Recipient, string Subject, string Html)
{
    /// <summary>The first link in the email, HTML-decoded.</summary>
    public Uri Link => new(WebUtility.HtmlDecode(Regex.Match(Html, "href=\"([^\"]+)\"").Groups[1].Value));
}

public sealed class CapturingEmailService : IEmailService
{
    private readonly ConcurrentQueue<SentEmail> _sent = new();

    public Task SendAsync(string recipient, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        _sent.Enqueue(new SentEmail(recipient, subject, htmlBody));
        return Task.CompletedTask;
    }

    public SentEmail Last(string recipient, string subjectContains) =>
        _sent.Last(e => e.Recipient == recipient && e.Subject.Contains(subjectContains, StringComparison.OrdinalIgnoreCase));

    public void Clear() => _sent.Clear();
}
