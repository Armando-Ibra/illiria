using System.Security.Claims;
using FluentValidation;
using Illiria.Api.Platform.Http;
using Illiria.Api.Platform.Identity;
using Illiria.Api.Platform.Persistence;
using Illiria.Api.Platform.Tenancy;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace Illiria.Api.Features.Organizations;

public sealed record CreateOrganizationRequest(string Name);

public sealed record OrganizationDto(Guid Id, string Name, OrganizationRole Role);

internal sealed class CreateOrganizationRequestValidator : AbstractValidator<CreateOrganizationRequest>
{
    public CreateOrganizationRequestValidator() =>
        RuleFor(r => r.Name).NotEmpty().MaximumLength(100)
            .Must(name => !name.Any(char.IsControl)).WithMessage("The name can't contain control characters.");
}

public static class OrganizationEndpoints
{
    public static IEndpointRouteBuilder MapOrganizationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/orgs", CreateAsync)
            .RequireAuthorization()
            .WithValidation<CreateOrganizationRequest>()
            .WithTags("Organizations")
            .WithName("CreateOrganization");

        var organization = endpoints.MapOrganizationScope().WithTags("Organizations");
        organization.MapGet("", GetAsync).WithName("GetOrganization");
        organization.MapMemberEndpoints();
        endpoints.MapInvitationEndpoints(organization);
        return endpoints;
    }

    private static async Task<Results<Created<OrganizationDto>, ProblemHttpResult>> CreateAsync(
        CreateOrganizationRequest request, ClaimsPrincipal principal, TenancyService tenancy, CancellationToken cancellationToken)
    {
        if (tenancy.Mode == TenancyMode.Single)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status403Forbidden, title: "Organizations can't be created in single-tenant mode.");
        }

        var organization = await tenancy.CreateOrganizationAsync(request.Name.Trim(), principal.GetUserId(), cancellationToken);
        return TypedResults.Created($"/api/orgs/{organization.Id}", new OrganizationDto(organization.Id, organization.Name, OrganizationRole.Owner));
    }

    private static async Task<Ok<OrganizationDto>> GetAsync(ICurrentOrganization current, AppDbContext db, CancellationToken cancellationToken)
    {
        var organization = await db.Organizations.SingleAsync(o => o.Id == current.Id, cancellationToken);
        return TypedResults.Ok(new OrganizationDto(organization.Id, organization.Name, current.Role!.Value));
    }
}
