using Illiria.Api.Platform.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Illiria.Api.Platform.Tenancy;

[GlobalEntity("Organizations are the tenants themselves.")]
public sealed class Organization
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public required string Name { get; set; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
}

/// <summary>Ordered by privilege: a higher value includes everything a lower one may do.</summary>
public enum OrganizationRole
{
    Member = 0,
    Admin = 1,
    Owner = 2,
}

[GlobalEntity("Lists a user's organizations across tenants; every query filters by OrganizationId or UserId explicitly.")]
public sealed class Membership
{
    public Guid OrganizationId { get; init; }
    public Guid UserId { get; init; }
    public OrganizationRole Role { get; set; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
}

[GlobalEntity("Accepted by token from outside the organization; every query filters explicitly.")]
public sealed class Invitation
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid OrganizationId { get; init; }
    public required string Email { get; init; }
    public OrganizationRole Role { get; init; }
    public required string TokenHash { get; init; }
    public Guid InvitedByUserId { get; init; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset ExpiresAt { get; init; }
    public DateTimeOffset? AcceptedAt { get; set; }
}

internal sealed class OrganizationConfiguration : IEntityTypeConfiguration<Organization>
{
    public void Configure(EntityTypeBuilder<Organization> builder)
    {
        builder.Property(o => o.Name).HasMaxLength(100);
    }
}

internal sealed class MembershipConfiguration : IEntityTypeConfiguration<Membership>
{
    public void Configure(EntityTypeBuilder<Membership> builder)
    {
        builder.HasKey(m => new { m.OrganizationId, m.UserId });
        builder.HasIndex(m => m.UserId);
        builder.Property(m => m.Role).HasConversion<string>().HasMaxLength(20);
        builder.HasOne<Organization>().WithMany().HasForeignKey(m => m.OrganizationId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<Identity.User>().WithMany().HasForeignKey(m => m.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class InvitationConfiguration : IEntityTypeConfiguration<Invitation>
{
    public void Configure(EntityTypeBuilder<Invitation> builder)
    {
        builder.Property(i => i.Email).HasMaxLength(256);
        builder.Property(i => i.TokenHash).HasMaxLength(64);
        builder.HasIndex(i => i.TokenHash).IsUnique();
        builder.HasIndex(i => i.OrganizationId);
        builder.Property(i => i.Role).HasConversion<string>().HasMaxLength(20);
        builder.HasOne<Organization>().WithMany().HasForeignKey(i => i.OrganizationId).OnDelete(DeleteBehavior.Cascade);
    }
}
