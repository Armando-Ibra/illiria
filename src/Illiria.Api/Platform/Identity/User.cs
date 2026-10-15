using Illiria.Api.Platform.Persistence;
using Microsoft.AspNetCore.Identity;

namespace Illiria.Api.Platform.Identity;

[GlobalEntity("A user can belong to several organizations.")]
public sealed class User : IdentityUser<Guid>
{
    public User()
    {
        Id = Guid.CreateVersion7();
        SecurityStamp = Guid.NewGuid().ToString();
    }

    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
}
