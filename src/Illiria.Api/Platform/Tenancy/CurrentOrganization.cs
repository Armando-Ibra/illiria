namespace Illiria.Api.Platform.Tenancy;

/// <summary>The organization the current request operates on. Null outside an organization-scoped endpoint.</summary>
public interface ICurrentOrganization
{
    Guid? Id { get; }
    OrganizationRole? Role { get; }
}

public sealed class CurrentOrganization : ICurrentOrganization
{
    public Guid? Id { get; private set; }
    public OrganizationRole? Role { get; private set; }

    /// <summary>Set once per scope, by <see cref="OrganizationScope"/> or by code that runs outside HTTP (jobs, tests).</summary>
    public void Set(Guid organizationId, OrganizationRole role)
    {
        if (Id is { } current && current != organizationId)
        {
            throw new InvalidOperationException("The current organization is already set for this scope.");
        }

        Id = organizationId;
        Role = role;
    }
}
