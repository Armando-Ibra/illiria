using System.ComponentModel.DataAnnotations;

namespace Illiria.Api.Platform.Hosting;

public sealed class AppOptions
{
    public const string Section = "App";

    /// <summary>Public URL of the web app (e.g. https://app.example.com). Every link in an email is built from it.</summary>
    [Required, Url]
    public string PublicUrl { get; set; } = "";
}
