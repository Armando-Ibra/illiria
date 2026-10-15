using Illiria.Api.Platform.Email;
using Illiria.Api.Platform.Hosting;
using Illiria.Api.Platform.Tenancy;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using Respawn;
using Testcontainers.PostgreSql;

namespace Illiria.Api.IntegrationTests.Infrastructure;

/// <summary>
/// The real API on a real Postgres (Testcontainers). One container per tenancy mode, shared by its
/// test collection; tables are emptied (Respawn) before each test.
/// </summary>
public abstract class ApiFactory(TenancyMode mode) : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string PublicUrl = "https://app.test";

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
    private Respawner? _respawner;

    public CapturingEmailService Emails { get; } = new();

    public async ValueTask InitializeAsync()
    {
        await _postgres.StartAsync();
        await MigrateCommand.RunAsync(Services, TestContext.Current.CancellationToken);

        await using var connection = new NpgsqlConnection(_postgres.GetConnectionString());
        await connection.OpenAsync();
        _respawner = await Respawner.CreateAsync(connection, new RespawnerOptions
        {
            DbAdapter = DbAdapter.Postgres,
            SchemasToInclude = ["public"],
            TablesToIgnore = ["__EFMigrationsHistory", "data_protection_keys"],
        });
    }

    public async Task ResetAsync()
    {
        await using var connection = new NpgsqlConnection(_postgres.GetConnectionString());
        await connection.OpenAsync();
        await _respawner!.ResetAsync(connection);
        await MigrateCommand.RunAsync(Services);
        Emails.Clear();
    }

    /// <summary>A browser-like client: cookies on, X-CSRF header on (like the web app's API client).</summary>
    public HttpClient CreateBrowserClient(bool withCsrfHeader = true)
    {
        var client = CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost"), HandleCookies = true });
        if (withCsrfHeader)
        {
            client.DefaultRequestHeaders.Add("X-CSRF", "1");
        }

        return client;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Default", _postgres.GetConnectionString());
        builder.UseSetting("App:PublicUrl", PublicUrl);
        builder.UseSetting("Smtp:Host", "smtp.invalid");
        builder.UseSetting("Smtp:From", "Illiria <no-reply@illiria.test>");
        builder.UseSetting("Tenancy:Mode", mode.ToString());
        builder.UseSetting("RateLimiting:AuthPermitLimit", "10000");
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IEmailService>();
            services.AddSingleton<IEmailService>(Emails);
        });
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        await _postgres.DisposeAsync();
        GC.SuppressFinalize(this);
    }
}

public sealed class MultiTenantApiFactory() : ApiFactory(TenancyMode.Multi);

public sealed class SingleTenantApiFactory() : ApiFactory(TenancyMode.Single);

[CollectionDefinition(Name)]
public sealed class MultiTenantCollection : ICollectionFixture<MultiTenantApiFactory>
{
    public const string Name = "multi-tenant";
}

[CollectionDefinition(Name)]
public sealed class SingleTenantCollection : ICollectionFixture<SingleTenantApiFactory>
{
    public const string Name = "single-tenant";
}
