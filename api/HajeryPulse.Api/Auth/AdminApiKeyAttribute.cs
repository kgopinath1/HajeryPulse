using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace HajeryPulse.Api.Auth;

/// <summary>
/// Interim gate for admin-only endpoints (e.g. device blacklisting) until real
/// role-based checks are decided (see Program.cs's TODO on AddAuthorization).
/// Requires a shared secret in the X-Admin-Key header, configured via
/// DeviceControl:AdminApiKey (set through user-secrets/environment, never
/// committed to appsettings.json). Combine with [Authorize] on the controller
/// so callers must also present a valid signed-in Entra ID token.
/// </summary>
public sealed class AdminApiKeyAttribute : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var config = context.HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        var expected = config["DeviceControl:AdminApiKey"];
        var provided = context.HttpContext.Request.Headers["X-Admin-Key"].ToString();

        if (string.IsNullOrEmpty(expected) || !string.Equals(expected, provided, StringComparison.Ordinal))
        {
            context.Result = new UnauthorizedObjectResult(new
            {
                error = new { code = "ADMIN_KEY_REQUIRED", message = "Missing or invalid admin key." }
            });
            return;
        }

        await next();
    }
}
