using Illiria.Api.Features.Auth;
using Illiria.Api.Features.Organizations;
using Illiria.Api.Features.Projects;
using Illiria.Api.Platform;
using Illiria.Api.Platform.Hosting;

var migrateOnly = MigrateCommand.IsRequested(args);

var builder = WebApplication.CreateBuilder(args);
builder.AddPlatform(migrateOnly);

var app = builder.Build();

if (migrateOnly)
{
    return await MigrateCommand.RunAsync(app.Services);
}

app.UsePlatform();
app.MapAuthEndpoints();
app.MapOrganizationEndpoints();
app.MapProjectEndpoints();

await app.RunAsync();
return 0;

/// <summary>Entry point, public for WebApplicationFactory in the integration tests.</summary>
public partial class Program;
