using Illiria.Api.Platform.Tenancy;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace Illiria.Api.Platform.Identity;

/// <summary>
/// Hooks the user lifecycle so every path (the Identity API endpoints included) applies the same rules:
/// in single-tenant mode a user joins the default organization once their email is confirmed.
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

        // Without email confirmation (development, tests) there is no later step to join on.
        if (result.Succeeded && !Options.SignIn.RequireConfirmedEmail)
        {
            await tenancy.JoinDefaultOrganizationAsync(user.Id, user.Email, CancellationToken);
        }

        return result;
    }

    public override async Task<IdentityResult> ConfirmEmailAsync(User user, string token)
    {
        var result = await base.ConfirmEmailAsync(user, token);
        if (result.Succeeded)
        {
            await tenancy.JoinDefaultOrganizationAsync(user.Id, user.Email, CancellationToken);
        }

        return result;
    }

    /// <summary>Ids come from URLs (e.g. /confirmEmail?userId=...): anything that isn't a GUID is simply not found.</summary>
    public override Task<User?> FindByIdAsync(string userId) =>
        Guid.TryParse(userId, out _) ? base.FindByIdAsync(userId) : Task.FromResult<User?>(null);
}
