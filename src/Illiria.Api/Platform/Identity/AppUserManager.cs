using Illiria.Api.Platform.Tenancy;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace Illiria.Api.Platform.Identity;

/// <summary>
/// Hooks user creation so every path that creates a user (the Identity API's /register included)
/// also gives the user an organization membership in single-tenant mode.
/// </summary>
public sealed class AppUserManager(
    IUserStore<User> store,
    IOptions<IdentityOptions> optionsAccessor,
    IPasswordHasher<User> passwordHasher,
    IEnumerable<IUserValidator<User>> userValidators,
    IEnumerable<IPasswordValidator<User>> passwordValidators,
    ILookupNormalizer keyNormalizer,
    IdentityErrorDescriber errors,
    IServiceProvider services,
    ILogger<UserManager<User>> logger,
    TenancyService tenancy)
    : UserManager<User>(store, optionsAccessor, passwordHasher, userValidators, passwordValidators, keyNormalizer, errors, services, logger)
{
    public override async Task<IdentityResult> CreateAsync(User user)
    {
        var result = await base.CreateAsync(user);
        if (result.Succeeded)
        {
            await tenancy.OnUserCreatedAsync(user.Id, CancellationToken);
        }

        return result;
    }
}
