using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using FluentValidation;
using Illiria.Api.Platform.Email;
using Illiria.Api.Platform.Hosting;
using Illiria.Api.Platform.Http;
using Illiria.Api.Platform.Identity;
using Illiria.Api.Platform.Persistence;
using Illiria.Api.Platform.Tenancy;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;

namespace Illiria.Api.Platform;

public static class PlatformExtensions
{
    public const string AuthRateLimitPolicy = "auth";
    public const string AuthCookieName = "illiria.auth";

    public static WebApplicationBuilder AddPlatform(this WebApplicationBuilder builder, bool migrateOnly)
    {
        ArgumentNullException.ThrowIfNull(builder);
        var configuration = builder.Configuration;
        var services = builder.Services;

        // The build runs the app to write openapi/illiria.json; it never serves requests, so skip config validation.
        var validateConfiguration = !IsBuildTimeOpenApiGeneration();
        if (validateConfiguration && builder.Environment.IsProduction())
        {
            ProductionGuard.Validate(configuration, migrateOnly);
        }

        services.AddSingleton(TimeProvider.System);
        var appOptions = services.AddOptions<AppOptions>().Bind(configuration.GetSection(AppOptions.Section)).ValidateDataAnnotations();
        var smtpOptions = services.AddOptions<SmtpOptions>().Bind(configuration.GetSection(SmtpOptions.Section)).ValidateDataAnnotations();
        if (validateConfiguration)
        {
            appOptions.ValidateOnStart();
            smtpOptions.ValidateOnStart();
        }
        services.AddOptions<TenancyOptions>().Bind(configuration.GetSection(TenancyOptions.Section));

        // Persistence
        services.AddDbContext<AppDbContext>(options => options
            .UseNpgsql(configuration.GetConnectionString("Default"))
            .UseSnakeCaseNamingConvention());

        // Tenancy
        services.AddScoped<CurrentOrganization>();
        services.AddScoped<ICurrentOrganization>(sp => sp.GetRequiredService<CurrentOrganization>());
        services.AddScoped<TenancyService>();

        // Identity: ASP.NET Core Identity API endpoints, cookie sessions for the web app.
        services.AddAuthorization();
        services
            .AddIdentityApiEndpoints<User>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.SignIn.RequireConfirmedEmail = configuration.GetValue("Identity:RequireConfirmedEmail", true);
                options.Password.RequiredLength = 10;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            })
            .AddUserManager<AppUserManager>()
            .AddEntityFrameworkStores<AppDbContext>();

        services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.Name = AuthCookieName;
            options.Cookie.HttpOnly = true;
            // Dev runs on http://localhost, where some browsers (Safari) drop Secure cookies.
            options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
            options.Cookie.SameSite = SameSiteMode.Lax;
            options.ExpireTimeSpan = TimeSpan.FromDays(14);
            options.SlidingExpiration = true;
            // An API answers with status codes, never with redirects to a login page.
            options.Events.OnRedirectToLogin = context => WriteStatus(context.Response, StatusCodes.Status401Unauthorized);
            options.Events.OnRedirectToAccessDenied = context => WriteStatus(context.Response, StatusCodes.Status403Forbidden);
        });

        // A password change or reset updates the security stamp; existing cookies stop working within this interval.
        var securityStampInterval = configuration.GetValue("Identity:SecurityStampValidationInterval", TimeSpan.FromMinutes(5));
        services.Configure<SecurityStampValidatorOptions>(options => options.ValidationInterval = securityStampInterval);

        // Keys in Postgres: cookies survive restarts and deploys, and are backed up with the database.
        services.AddDataProtection().PersistKeysToDbContext<AppDbContext>().SetApplicationName("Illiria");

        // Email
        services.AddSingleton<IEmailService, SmtpEmailService>();
        services.AddTransient<IEmailSender<User>, IdentityEmailSender>();

        // HTTP
        services.AddProblemDetails();
        services.AddValidatorsFromAssemblyContaining<AppDbContext>(includeInternalTypes: true);
        services.ConfigureHttpJsonOptions(options => options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
        services.AddOpenApi(options => options.AddOperationTransformer(OrganizationScope.DocumentRouteParameter));
        services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database", tags: ["ready"]);

        var authPermitLimit = configuration.GetValue("RateLimiting:AuthPermitLimit", 20);
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy(AuthRateLimitPolicy, context => RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = authPermitLimit, Window = TimeSpan.FromMinutes(1) }));
        });

        // Behind Caddy: trust X-Forwarded-* only from the configured proxy networks, so rate limits and
        // logs see the real client IP. Without configuration only loopback is trusted.
        services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            foreach (var network in configuration.GetSection("ForwardedHeaders:KnownNetworks").Get<string[]>() ?? [])
            {
                options.KnownIPNetworks.Add(System.Net.IPNetwork.Parse(network));
            }
        });

        return builder;
    }

    public static WebApplication UsePlatform(this WebApplication app)
    {
        ArgumentNullException.ThrowIfNull(app);

        app.UseForwardedHeaders();
        app.UseExceptionHandler();
        app.UseStatusCodePages();
        app.UseMiddleware<SecurityHeadersMiddleware>();

        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi();
            app.MapScalarApiReference();
        }

        app.UseRouting();
        app.UseRateLimiter();
        app.UseAuthentication();
        app.UseAuthorization();
        app.UseMiddleware<CsrfHeaderMiddleware>();

        app.MapHealthChecks("/health/live", new() { Predicate = _ => false });
        app.MapHealthChecks("/health/ready", new() { Predicate = check => check.Tags.Contains("ready") });
        return app;
    }

    /// <summary>True when the build-time OpenAPI generator (GetDocument.Insider) is running the app.</summary>
    private static bool IsBuildTimeOpenApiGeneration() =>
        System.Reflection.Assembly.GetEntryAssembly()?.GetName().Name == "GetDocument.Insider";

    private static Task WriteStatus(HttpResponse response, int statusCode)
    {
        response.StatusCode = statusCode;
        return Task.CompletedTask;
    }
}
