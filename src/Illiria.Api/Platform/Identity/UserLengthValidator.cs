using Microsoft.AspNetCore.Identity;

namespace Illiria.Api.Platform.Identity;

/// <summary>Rejects emails/user names longer than the database columns (256) with a 400 instead of a database error.</summary>
public sealed class UserLengthValidator : IUserValidator<User>
{
    public const int MaxLength = 256;

    public Task<IdentityResult> ValidateAsync(UserManager<User> manager, User user)
    {
        ArgumentNullException.ThrowIfNull(user);
        return Task.FromResult(user.Email?.Length > MaxLength || user.UserName?.Length > MaxLength
            ? IdentityResult.Failed(new IdentityError { Code = "EmailTooLong", Description = $"Email must be at most {MaxLength} characters." })
            : IdentityResult.Success);
    }
}
