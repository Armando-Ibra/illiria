using System.Reflection;
using System.Text.RegularExpressions;
using Illiria.Api.Platform.Persistence;
using NetArchTest.Rules;

namespace Illiria.Api.Tests;

public sealed partial class ArchitectureTests
{
    private const string FeaturesNamespace = "Illiria.Api.Features";
    private static readonly Assembly Api = typeof(AppDbContext).Assembly;

    [Fact]
    public void Platform_does_not_depend_on_features()
    {
        var result = Types.InAssembly(Api)
            .That().ResideInNamespace("Illiria.Api.Platform")
            .ShouldNot().HaveDependencyOn(FeaturesNamespace)
            .GetResult();

        result.FailingTypeNames.ShouldBeNull();
    }

    [Fact]
    public void Features_do_not_depend_on_each_other()
    {
        var features = Api.GetTypes()
            .Select(t => t.Namespace)
            .OfType<string>()
            .Where(ns => ns.StartsWith(FeaturesNamespace + ".", StringComparison.Ordinal))
            .Select(ns => string.Join('.', ns.Split('.').Take(4)))
            .Distinct()
            .ToList();

        features.Count.ShouldBeGreaterThan(1);
        foreach (var feature in features)
        {
            var others = features.Where(f => f != feature).ToArray();
            var result = Types.InAssembly(Api)
                .That().ResideInNamespace(feature)
                .ShouldNot().HaveDependencyOnAny(others)
                .GetResult();

            result.FailingTypeNames.ShouldBeNull($"{feature} must not depend on another feature; move shared code to Platform.");
        }
    }

    /// <summary>
    /// A bare IgnoreQueryFilters() also drops the organization filter and leaks rows across tenants.
    /// Drop other filters by name: IgnoreQueryFilters(["soft-delete"]).
    /// </summary>
    [Fact]
    public void Source_never_ignores_all_query_filters()
    {
        var sourceRoot = Path.Combine(RepositoryRoot(), "src");
        var offenders = Directory.EnumerateFiles(sourceRoot, "*.cs", SearchOption.AllDirectories)
            .Where(file => !file.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}", StringComparison.Ordinal))
            .Where(file => BareIgnoreQueryFilters().IsMatch(File.ReadAllText(file)))
            .ToList();

        offenders.ShouldBeEmpty();
    }

    /// <summary>
    /// Raw SQL and bulk updates of OrganizationId bypass the organization filter's write guard (SaveChanges).
    /// Features must not use them; Platform code that needs raw SQL documents why.
    /// </summary>
    [Fact]
    public void Features_never_use_raw_sql_or_rewrite_organization_ids()
    {
        var featuresRoot = Path.Combine(RepositoryRoot(), "src", "Illiria.Api", "Features");
        var offenders = Directory.EnumerateFiles(featuresRoot, "*.cs", SearchOption.AllDirectories)
            .Where(file => UnsafeDataAccess().IsMatch(File.ReadAllText(file)))
            .ToList();

        offenders.ShouldBeEmpty();
    }

    private static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "Illiria.slnx")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName ?? throw new InvalidOperationException("Repository root (Illiria.slnx) not found.");
    }

    [GeneratedRegex(@"IgnoreQueryFilters\(\s*\)")]
    private static partial Regex BareIgnoreQueryFilters();

    [GeneratedRegex(@"ExecuteSql|FromSql|SqlQuery|SetProperty\([^)]*OrganizationId")]
    private static partial Regex UnsafeDataAccess();
}
