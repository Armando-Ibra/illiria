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
    private readonly ConcurrentDictionary<string, bool> _unreachable = new(StringComparer.OrdinalIgnoreCase);

    public Task SendAsync(string recipient, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        if (_unreachable.ContainsKey(recipient))
        {
            throw new InvalidOperationException($"SMTP failure (simulated) for {recipient}.");
        }

        _sent.Enqueue(new SentEmail(recipient, subject, htmlBody));
        return Task.CompletedTask;
    }

    /// <summary>Makes sending to <paramref name="recipient"/> fail, like an SMTP outage.</summary>
    public void FailFor(string recipient) => _unreachable[recipient] = true;

    public IReadOnlyCollection<SentEmail> Sent => [.. _sent];

    public SentEmail Last(string recipient, string subjectContains) =>
        _sent.Last(e => e.Recipient == recipient && e.Subject.Contains(subjectContains, StringComparison.OrdinalIgnoreCase));

    public void Clear()
    {
        _sent.Clear();
        _unreachable.Clear();
    }
}
