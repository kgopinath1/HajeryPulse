using System.Security.Claims;
using Microsoft.Identity.Web;

namespace HajeryPulse.Api.Demo;

/// <summary>
/// App Store / Play review account support. Entra users whose object ID (oid)
/// is listed under DemoMode:UserObjectIds get generated sample data from the
/// Demo*Repository classes instead of the reporting database, and skip device
/// approval. Matching is on the token's validated oid — never the email or
/// display name, which a tenant admin could rename onto another account.
///
/// An empty or missing list means nobody is a demo user, so a missing config
/// value can only fall back to normal behaviour.
/// </summary>
public static class DemoMode
{
    public static bool IsDemoUser(this ClaimsPrincipal? user, IConfiguration config)
    {
        if (user?.Identity?.IsAuthenticated != true) return false;

        var oid = user.GetObjectId();
        if (string.IsNullOrWhiteSpace(oid)) return false;

        var ids = config.GetSection("DemoMode:UserObjectIds").Get<string[]>() ?? Array.Empty<string>();
        return ids.Any(id => string.Equals(id?.Trim(), oid, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// Registers <typeparamref name="TService"/> so each request gets the demo
    /// implementation for the demo account and the real one for everyone else.
    /// The real repository (and its DB connection) is never constructed for the
    /// demo account, and vice versa.
    /// </summary>
    public static IServiceCollection AddDemoSwitched<TService, TReal, TDemo>(this IServiceCollection services)
        where TService : class
        where TReal : class, TService
        where TDemo : class, TService
    {
        services.AddScoped<TReal>();
        services.AddScoped<TDemo>();
        services.AddScoped<TService>(sp =>
            sp.GetRequiredService<IHttpContextAccessor>().HttpContext?.User
                .IsDemoUser(sp.GetRequiredService<IConfiguration>()) == true
                ? sp.GetRequiredService<TDemo>()
                : sp.GetRequiredService<TReal>());
        return services;
    }
}
