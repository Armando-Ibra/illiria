namespace Illiria.Api.Platform.Persistence;

/// <summary>
/// Marks an entity as owned by one organization. AppDbContext adds the <see cref="QueryFilters.Organization"/>
/// filter (queries outside an organization scope return nothing) and refuses writes to another organization's rows.
/// </summary>
public interface IOrganizationScoped
{
    Guid OrganizationId { get; set; }
}

/// <summary>
/// Opt-out for entities that are deliberately not organization-scoped. The reason is mandatory and
/// the architecture tests fail for any entity that is neither scoped nor marked global.
/// </summary>
[AttributeUsage(AttributeTargets.Class, Inherited = false)]
public sealed class GlobalEntityAttribute(string reason) : Attribute
{
    public string Reason { get; } = reason;
}

public static class QueryFilters
{
    /// <summary>Named so a query can drop another filter (e.g. soft delete) without ever dropping this one.</summary>
    public const string Organization = "organization";
}
