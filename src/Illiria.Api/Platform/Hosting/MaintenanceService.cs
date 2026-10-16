using Illiria.Api.Platform.Identity;
using Illiria.Api.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Illiria.Api.Platform.Hosting;

/// <summary>
/// Hourly cleanup: expired sessions, and accounts never confirmed within 48 hours. Purging unconfirmed accounts
/// limits "pre-registration" of someone else's email address to a short window.
/// </summary>
public sealed partial class MaintenanceService(IServiceScopeFactory scopes, TimeProvider time, ILogger<MaintenanceService> logger) : BackgroundService
{
    public static readonly TimeSpan UnconfirmedAccountLifetime = TimeSpan.FromHours(48);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(1), time);
        do
        {
            try
            {
                await RunOnceAsync(stoppingToken);
            }
#pragma warning disable CA1031 // A failed cleanup must not stop the host; it runs again next hour.
            catch (Exception ex) when (ex is not OperationCanceledException)
#pragma warning restore CA1031
            {
                LogCleanupFailed(logger, ex);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    public async Task RunOnceAsync(CancellationToken cancellationToken = default)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = time.GetUtcNow();

        var sessions = await db.Set<AuthSession>().Where(s => s.ExpiresAt < now).ExecuteDeleteAsync(cancellationToken);
        var cutoff = now - UnconfirmedAccountLifetime;
        var accounts = await db.Users
            .Where(u => !u.EmailConfirmed && u.CreatedAt < cutoff && !db.Memberships.Any(m => m.UserId == u.Id))
            .ExecuteDeleteAsync(cancellationToken);

        LogCleanup(logger, sessions, accounts);
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Cleanup removed {Sessions} expired sessions and {Accounts} unconfirmed accounts.")]
    private static partial void LogCleanup(ILogger logger, int sessions, int accounts);

    [LoggerMessage(Level = LogLevel.Error, Message = "Cleanup failed.")]
    private static partial void LogCleanupFailed(ILogger logger, Exception exception);
}
