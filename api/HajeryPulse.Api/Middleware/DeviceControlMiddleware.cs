using HajeryPulse.Api.Demo;
using HajeryPulse.Api.Services;
using Microsoft.Identity.Web;

namespace HajeryPulse.Api.Middleware;

/// <summary>
/// Device activation enforcement — the compensating control for RBAC not
/// existing yet. Every signed-in request must carry X-Device-Key: the secret
/// the app received when the user activated this phone with a code from IT
/// (see DeviceActivationService). A missing, unknown or other user's key is
/// DEVICE_NOT_ACTIVATED; a key replaced by a newer activation or revoked by
/// IT is DEVICE_REVOKED. Either way the app shows its activation screen.
///
/// Unauthenticated requests pass through so [Authorize] answers 401 (which
/// the app refreshes its token on). Activation itself, sign-out, health and
/// swagger are exempt.
/// </summary>
public sealed class DeviceControlMiddleware
{
    private static readonly string[] ExemptPrefixes =
    {
        "/health", "/swagger", "/api/v1/device/activate", "/api/v1/auth/signout",
    };

    private readonly RequestDelegate _next;

    public DeviceControlMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext ctx, IDeviceActivationService devices, IConfiguration config)
    {
        var path = ctx.Request.Path.Value ?? "";
        if (ExemptPrefixes.Any(p => path.StartsWith(p, StringComparison.OrdinalIgnoreCase)) ||
            ctx.User?.Identity?.IsAuthenticated != true)
        {
            await _next(ctx);
            return;
        }

        // The App Store / Play review account only ever sees generated sample
        // data, and reviewers use many devices — it never needs a code.
        if (ctx.User.IsDemoUser(config))
        {
            await _next(ctx);
            return;
        }

        var status = Guid.TryParse(ctx.User.GetObjectId(), out var oid)
            ? await devices.CheckAsync(oid, ctx.Request.Headers["X-Device-Key"].ToString())
            : DeviceKeyStatus.NotActivated;

        switch (status)
        {
            case DeviceKeyStatus.Active:
                await _next(ctx);
                break;
            case DeviceKeyStatus.Revoked:
                await RejectAsync(ctx, "DEVICE_REVOKED",
                    "Hajery Pulse has been turned off on this device, either because it was activated on another device or by IT. Enter a new activation code from IT to continue.");
                break;
            default:
                await RejectAsync(ctx, "DEVICE_NOT_ACTIVATED",
                    "This device needs to be activated. Enter the activation code from IT.");
                break;
        }
    }

    private static async Task RejectAsync(HttpContext ctx, string code, string message)
    {
        ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
        ctx.Response.ContentType = "application/json";
        await ctx.Response.WriteAsJsonAsync(new { error = new { code, message } });
    }
}
