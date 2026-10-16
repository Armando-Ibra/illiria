using System.ComponentModel.DataAnnotations;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;
using MimeKit.Text;

namespace Illiria.Api.Platform.Email;

public interface IEmailService
{
    /// <summary>Sends an HTML email. Callers must HTML-encode any user-provided value in <paramref name="htmlBody"/>.</summary>
    Task SendAsync(string recipient, string subject, string htmlBody, CancellationToken cancellationToken = default);
}

public sealed class SmtpOptions
{
    public const string Section = "Smtp";

    [Required]
    public string Host { get; set; } = "localhost";

    public int Port { get; set; } = 587;
    public SecureSocketOptions Security { get; set; } = SecureSocketOptions.StartTls;
    public string? Username { get; set; }
    public string? Password { get; set; }

    [Required]
    public string From { get; set; } = "Illiria <no-reply@localhost>";
}

public sealed partial class SmtpEmailService(IOptions<SmtpOptions> options, ILogger<SmtpEmailService> logger) : IEmailService
{
    public async Task SendAsync(string recipient, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        var settings = options.Value;
        using var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(settings.From));
        message.To.Add(MailboxAddress.Parse(recipient));
        message.Subject = subject;
        message.Body = new TextPart(TextFormat.Html) { Text = htmlBody };

        using var client = new SmtpClient();
        await client.ConnectAsync(settings.Host, settings.Port, settings.Security, cancellationToken);
        if (!string.IsNullOrEmpty(settings.Username))
        {
            await client.AuthenticateAsync(settings.Username, settings.Password ?? "", cancellationToken);
        }

        await client.SendAsync(message, cancellationToken);
        await client.DisconnectAsync(quit: true, cancellationToken);
        LogEmailSent(logger, subject);
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Email sent: {Subject}")]
    private static partial void LogEmailSent(ILogger logger, string subject);
}
