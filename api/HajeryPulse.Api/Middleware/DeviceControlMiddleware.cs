using HajeryPulse.Api.Auth;
using HajeryPulse.Api.Demo;
using HajeryPulse.Api.Services;

namespace HajeryPulse.Api.Middleware;

/// <summary>
/// User and device enforcement — the compensating control for RBAC not
/// existing yet. Every signed-in request needs:
///   1. the user's email active in dim.[User], else USER_NOT_ALLOWED; and
///   2. X-Device-Id + X-Device-Token matching an active device of that
///      user (see DeviceTokenService), else DEVICE_NOT_ACTIVATED (new
///      device, waiting for a token, or token not on the phone after a
///      reinstall) or DEVICE_REVOKED (turned off by IT).
/// The app shows its "access not enabled" or token screen for these.
///
/// /api/v1/device/* (Get token, enter token) only needs step 1.
/// Unauthenticated requests pass through so [Authorize] answers 401 (which
/// the app refreshes its token on). Sign-out, health and swagger are exempt.
/// </summary>
public sealed class DeviceControlMiddleware
{
    private static readonly string[] ExemptPrefixes =
    {
        "/health", "/swagger", "/api/v1/auth/signout",
    };

    private const string DevicePrefix = "/api/v1/device/";

    private readonly RequestDelegate _next;

    public DeviceControlMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext ctx, IDeviceTokenService devices, IConfiguration config)
    {
        var path = ctx.Request.Path.Value ?? "";
        if (ExemptPrefixes.Any(p => path.StartsWith(p, StringComparison.OrdinalIgnoreCase)) ||
            ctx.User?.Identity?.IsAuthenticated != true)
        {
            await _next(ctx);
            return;
        }

        // The App Store / Play review account only ever sees generated sample
        // data, and reviewers use many devices — it's not in dim.[User] and
        // never needs a token.
        if (ctx.User.IsDemoUser(config))
        {
            await _next(ctx);
            return;
        }

        var check = await devices.CheckAsync(ctx.User.GetEmail(),
            ctx.Request.Headers["X-Device-Id"].ToString(), ctx.Request.Headers["X-Device-Token"].ToString());

        if (check.State == DeviceState.UserNotAllowed)
        {
            await RejectAsync(ctx, "USER_NOT_ALLOWED",
                "Your account doesn't have access to Hajery Pulse. Contact IT if you need it.", null);
            return;
        }

        if (check.State == DeviceState.Active || path.StartsWith(DevicePrefix, StringComparison.OrdinalIgnoreCase))
        {
            await _next(ctx);
            return;
        }

        // Lets the app pick the right screen: Get token, waiting for IT,
        // enter token (new or after a reinstall), or "use on this device"
        // when others are active.
        var device = new
        {
            state = check.State switch
            {
                DeviceState.Requested => "requested",
                DeviceState.Issued => "issued",
                DeviceState.TokenMissing => "known",
                DeviceState.Revoked => "revoked",
                _ => "none",
            },
            activeDevices = check.ActiveDevices,
        };

        if (check.State == DeviceState.Revoked)
            await RejectAsync(ctx, "DEVICE_REVOKED",
                "Hajery Pulse has been turned off on this device by IT. Tap \"Get token\" to ask for a new token.", device);
        else
            await RejectAsync(ctx, "DEVICE_NOT_ACTIVATED",
                "This device needs a token from IT.", device);
    }

    private static async Task RejectAsync(HttpContext ctx, string code, string message, object? device)
    {
        ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
        ctx.Response.ContentType = "application/json";
        await ctx.Response.WriteAsJsonAsync(new { error = new { code, message, device } });
    }
}
