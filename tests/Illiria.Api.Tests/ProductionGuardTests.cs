using Illiria.Api.Platform.Hosting;
using Microsoft.Extensions.Configuration;

namespace Illiria.Api.Tests;

public sealed class ProductionGuardTests
{
    private static readonly Dictionary<string, string?> Valid = new()
    {
        ["ConnectionStrings:Default"] = "Host=db;Database=illiria",
        ["App:PublicUrl"] = "https://app.example.com",
        ["Smtp:Host"] = "smtp.example.com",
        ["Smtp:From"] = "no-reply@example.com",
    };

    [Fact]
    public void A_complete_configuration_passes() => Should.NotThrow(() => ProductionGuard.Validate(Build(Valid), migrateOnly: false));

    [Theory]
    [InlineData("ConnectionStrings:Default", null)]
    [InlineData("App:PublicUrl", null)]
    [InlineData("App:PublicUrl", "http://app.example.com")]
    [InlineData("App:PublicUrl", "/relative")]
    [InlineData("Smtp:Host", "")]
    [InlineData("Smtp:From", null)]
    public void A_missing_or_unsafe_setting_stops_startup(string key, string? value)
    {
        var settings = new Dictionary<string, string?>(Valid) { [key] = value };

        Should.Throw<InvalidOperationException>(() => ProductionGuard.Validate(Build(settings), migrateOnly: false)).Message.ShouldContain(key);
    }

    [Fact]
    public void Migrations_only_need_the_connection_string()
    {
        var settings = new Dictionary<string, string?> { ["ConnectionStrings:Default"] = "Host=db" };

        Should.NotThrow(() => ProductionGuard.Validate(Build(settings), migrateOnly: true));
        Should.Throw<InvalidOperationException>(() => ProductionGuard.Validate(Build([]), migrateOnly: true));
    }

    private static IConfiguration Build(IEnumerable<KeyValuePair<string, string?>> settings) =>
        new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
}
