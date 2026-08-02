using System.Security.Claims;
using HajeryPulse.Api.Services;

namespace HajeryPulse.Api.Middleware;

/// <summary>
/// Device allowlist enforcement — the compensating control for RBAC not
/// existing yet. Every request must carry X-Device-Id, and that device must
/// already be explicitly approved by an admin (see AdminDevicesController),
/// or it's rejected. A never-seen device gets recorded (unapproved) so an
/// admin can find and approve it, but the request itself is still blocked.
///
/// Admin device-management routes, health, and swagger are exempt so the
/// registry can always be managed regardless of the caller's own device state.
///
/// This is still a soft control: the device ID is self-reported by the
/// client, so it narrows a valid token to pre-approved devices — it doesn't
/// replace token validation as the source of identity.
/// </summary>
public sealed class DeviceControlMiddleware
{
    private readonly RequestDelegate _next;

    public DeviceControlMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext ctx, IDeviceRegistryService registry)
    {
        var path = ctx.Request.Path.Value ?? "";
        if (path.StartsWith("/health", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/swagger", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/api/v1/admin/devices", StringComparison.OrdinalIgnoreCase))
        {
            await _next(ctx);
            return;
        }

        var deviceId = ctx.Request.Headers["X-Device-Id"].ToString();
        if (string.IsNullOrWhiteSpace(deviceId))
        {
            await RejectAsync(ctx, "DEVICE_ID_REQUIRED", "This app build doesn't identify its device. Update the app.");
            return;
        }

        var userId = ctx.User?.Identity?.IsAuthenticated == true
            ? ctx.User.FindFirstValue(ClaimTypes.NameIdentifier)
            : null;
        var platform = ctx.Request.Headers["X-Device-Platform"].ToString();
        var record = await registry.TouchAsync(deviceId, userId, string.IsNullOrWhiteSpace(platform) ? null : platform);

        if (record.IsBlacklisted)
        {
            await RejectAsync(ctx, "DEVICE_BLOCKED", "This device has been blocked. Contact IT support.");
            return;
        }

        if (!record.IsApproved)
        {
            await RejectAsync(ctx, "DEVICE_NOT_APPROVED",
                $"This device isn't approved yet. Give IT this device ID to enable access: {deviceId}");
            return;
        }

        await _next(ctx);
    }

    private static async Task RejectAsync(HttpContext ctx, string code, string message)
    {
        ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
        ctx.Response.ContentType = "application/json";
        await ctx.Response.WriteAsJsonAsync(new { error = new { code, message } });
    }
}
