using FluentValidation;
using Illiria.Api.Platform.Http;
using Illiria.Api.Platform.Persistence;
using Illiria.Api.Platform.Tenancy;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace Illiria.Api.Features.Projects;

public sealed record ProjectDto(Guid Id, string Name, string? Description, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

public sealed record SaveProjectRequest(string Name, string? Description);

internal sealed class SaveProjectRequestValidator : AbstractValidator<SaveProjectRequest>
{
    public SaveProjectRequestValidator()
    {
        RuleFor(r => r.Name).NotEmpty().MaximumLength(200);
        RuleFor(r => r.Description).MaximumLength(2000);
    }
}

/// <summary>
/// Every query here is filtered to the organization in the route by AppDbContext:
/// handlers never filter by OrganizationId themselves, and can't read or write another organization's rows.
/// </summary>
public static class ProjectEndpoints
{
    public static IEndpointRouteBuilder MapProjectEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var projects = endpoints.MapOrganizationScope().MapGroup("/projects").WithTags("Projects");
        projects.MapGet("", ListAsync).WithName("ListProjects");
        projects.MapGet("/{id:guid}", GetAsync).WithName("GetProject");
        projects.MapPost("", CreateAsync).WithValidation<SaveProjectRequest>().WithName("CreateProject");
        projects.MapPut("/{id:guid}", UpdateAsync).WithValidation<SaveProjectRequest>().WithName("UpdateProject");
        projects.MapDelete("/{id:guid}", DeleteAsync).RequireOrganizationRole(OrganizationRole.Admin).WithName("DeleteProject");
        return endpoints;
    }

    private static async Task<Ok<List<ProjectDto>>> ListAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        var projects = await db.Set<Project>()
            .OrderByDescending(p => p.CreatedAt)
            .Take(200)
            .Select(p => ToDto(p))
            .ToListAsync(cancellationToken);
        return TypedResults.Ok(projects);
    }

    private static async Task<Results<Ok<ProjectDto>, NotFound>> GetAsync(Guid id, AppDbContext db, CancellationToken cancellationToken)
    {
        var project = await db.Set<Project>().SingleOrDefaultAsync(p => p.Id == id, cancellationToken);
        return project is null ? TypedResults.NotFound() : TypedResults.Ok(ToDto(project));
    }

    private static async Task<Created<ProjectDto>> CreateAsync(
        SaveProjectRequest request, ICurrentOrganization current, AppDbContext db, TimeProvider time, CancellationToken cancellationToken)
    {
        var now = time.GetUtcNow();
        var project = new Project { Name = request.Name.Trim(), Description = request.Description, CreatedAt = now, UpdatedAt = now };
        db.Add(project);
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.Created($"/api/orgs/{current.Id}/projects/{project.Id}", ToDto(project));
    }

    private static async Task<Results<Ok<ProjectDto>, NotFound>> UpdateAsync(
        Guid id, SaveProjectRequest request, AppDbContext db, TimeProvider time, CancellationToken cancellationToken)
    {
        var project = await db.Set<Project>().SingleOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (project is null)
        {
            return TypedResults.NotFound();
        }

        project.Name = request.Name.Trim();
        project.Description = request.Description;
        project.UpdatedAt = time.GetUtcNow();
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.Ok(ToDto(project));
    }

    private static async Task<Results<NoContent, NotFound>> DeleteAsync(Guid id, AppDbContext db, CancellationToken cancellationToken)
    {
        var deleted = await db.Set<Project>().Where(p => p.Id == id).ExecuteDeleteAsync(cancellationToken);
        return deleted == 0 ? TypedResults.NotFound() : TypedResults.NoContent();
    }

    private static ProjectDto ToDto(Project p) => new(p.Id, p.Name, p.Description, p.CreatedAt, p.UpdatedAt);
}
