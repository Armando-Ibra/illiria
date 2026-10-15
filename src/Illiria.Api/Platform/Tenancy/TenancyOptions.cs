namespace Illiria.Api.Platform.Tenancy;

[System.Diagnostics.CodeAnalysis.SuppressMessage("Naming", "CA1720", Justification = "\"Single\" reads naturally in configuration: Tenancy:Mode = Single.")]
public enum TenancyMode
{
    /// <summary>One implicit organization: every user joins it on registration, the first one as Owner.</summary>
    Single,

    /// <summary>Users create organizations and invite members.</summary>
    Multi,
}

public sealed class TenancyOptions
{
    public const string Section = "Tenancy";

    public TenancyMode Mode { get; set; } = TenancyMode.Multi;
    public string DefaultOrganizationName { get; set; } = "Default";
}
