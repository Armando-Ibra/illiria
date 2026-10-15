using Illiria.Api.Platform.Persistence;
using Illiria.Api.Platform.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace Illiria.Api.Platform.Hosting;

/// <summary>
/// <c>dotnet Illiria.Api.dll migrate</c>: applies EF migrations and seeds what the app needs, then exits.
/// Same image and configuration as the API, so the two can never drift. The API never migrates on startup.
/// </summary>
public static partial class MigrateCommand
{
    public const string Verb = "migrate";

    public static bool IsRequested(string[] args) => args is [Verb, ..];

    public static async Task<int> RunAsync(IServiceProvider services, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(services);
        await using var scope = services.CreateAsyncScope();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger(nameof(MigrateCommand));

        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync(cancellationToken);
        await scope.ServiceProvider.GetRequiredService<TenancyService>().EnsureDefaultOrganizationAsync(cancellationToken);

        LogCompleted(logger);
        return 0;
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Database migrated and seeded.")]
    private static partial void LogCompleted(ILogger logger);
}
