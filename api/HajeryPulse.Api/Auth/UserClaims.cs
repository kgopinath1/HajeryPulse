using System.Security.Claims;

namespace HajeryPulse.Api.Auth;

public static class UserClaims
{
    /// <summary>
    /// The signed-in user's email (their Entra sign-in name), lower-cased —
    /// the key for dim.[User] and app.DeviceToken. Null if the token has none.
    /// </summary>
    public static string? GetEmail(this ClaimsPrincipal? user)
    {
        if (user?.Identity?.IsAuthenticated != true) return null;

        var email = user.FindFirstValue("preferred_username")
                    ?? user.FindFirstValue("upn")
                    ?? user.FindFirstValue(ClaimTypes.Upn)
                    ?? user.FindFirstValue("email")
                    ?? user.FindFirstValue(ClaimTypes.Email)
                    ?? user.FindFirstValue("unique_name");

        return string.IsNullOrWhiteSpace(email) || !email.Contains('@')
            ? null
            : email.Trim().ToLowerInvariant();
    }
}
