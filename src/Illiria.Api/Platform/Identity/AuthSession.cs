using System.Security.Claims;
using System.Security.Cryptography;
using Illiria.Api.Platform.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Illiria.Api.Platform.Identity;

/// <summary>A signed-in session. The auth cookie only carries this row's (unguessable) id.</summary>
[GlobalEntity("Looked up by the cookie handler before any organization is known; the key is a random secret.")]
public sealed class AuthSession
{
    public required string Id { get; init; }
    public Guid? UserId { get; init; }
    public required byte[] Ticket { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

internal sealed class AuthSessionConfiguration : IEntityTypeConfiguration<AuthSession>
{
    public void Configure(EntityTypeBuilder<AuthSession> builder)
    {
        builder.ToTable("auth_sessions");
        builder.Property(s => s.Id).HasMaxLength(64);
        builder.HasIndex(s => s.UserId);
        builder.HasIndex(s => s.ExpiresAt);
    }
}

/// <summary>
/// Server-side session store for the auth cookie. Logging out deletes the row, so a copied cookie stops working
/// immediately (with cookie-only tickets it would stay valid until it expires).
/// </summary>
public sealed class DatabaseTicketStore(IServiceScopeFactory scopes, TimeProvider time) : ITicketStore
{
    public async Task<string> StoreAsync(AuthenticationTicket ticket)
    {
        ArgumentNullException.ThrowIfNull(ticket);
        var key = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Add(new AuthSession
        {
            Id = key,
            UserId = Guid.TryParse(ticket.Principal.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) ? userId : null,
            Ticket = TicketSerializer.Default.Serialize(ticket),
            ExpiresAt = ticket.Properties.ExpiresUtc,
            UpdatedAt = time.GetUtcNow(),
        });
        await db.SaveChangesAsync();
        return key;
    }

    public async Task RenewAsync(string key, AuthenticationTicket ticket)
    {
        ArgumentNullException.ThrowIfNull(ticket);
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var serialized = TicketSerializer.Default.Serialize(ticket);
        await db.Set<AuthSession>().Where(s => s.Id == key).ExecuteUpdateAsync(s => s
            .SetProperty(x => x.Ticket, serialized)
            .SetProperty(x => x.ExpiresAt, ticket.Properties.ExpiresUtc)
            .SetProperty(x => x.UpdatedAt, time.GetUtcNow()));
    }

    public async Task<AuthenticationTicket?> RetrieveAsync(string key)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var session = await db.Set<AuthSession>().AsNoTracking().SingleOrDefaultAsync(s => s.Id == key);
        return session is null || session.ExpiresAt <= time.GetUtcNow()
            ? null
            : TicketSerializer.Default.Deserialize(session.Ticket);
    }

    public async Task RemoveAsync(string key)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Set<AuthSession>().Where(s => s.Id == key).ExecuteDeleteAsync();
    }
}
