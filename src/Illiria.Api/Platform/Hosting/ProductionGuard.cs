namespace Illiria.Api.Platform.Hosting;

/// <summary>Fails fast at startup instead of at the first request that needs a missing setting.</summary>
public static class ProductionGuard
{
    public static void Validate(IConfiguration configuration, bool migrateOnly)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        List<string> problems = [];

        if (string.IsNullOrWhiteSpace(configuration.GetConnectionString("Default")))
        {
            problems.Add("ConnectionStrings:Default is required.");
        }

        if (!migrateOnly)
        {
            var publicUrl = configuration["App:PublicUrl"];
            if (!Uri.TryCreate(publicUrl, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps)
            {
                problems.Add("App:PublicUrl must be an absolute https URL.");
            }

            if (string.IsNullOrWhiteSpace(configuration["Smtp:Host"]) || string.IsNullOrWhiteSpace(configuration["Smtp:From"]))
            {
                problems.Add("Smtp:Host and Smtp:From are required.");
            }
        }

        if (problems.Count > 0)
        {
            throw new InvalidOperationException("Invalid production configuration: " + string.Join(" ", problems));
        }
    }
}
