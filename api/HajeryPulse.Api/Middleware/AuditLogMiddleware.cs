using System.Security.Claims;
using HajeryPulse.Api.Data;
using Dapper;

namespace HajeryPulse.Api.Middleware;

/// <summary>
/// Logs every authenticated request to audit.Event so compliance has a forensic trail.
/// Only mutating actions (POST/PUT/DELETE) and dashboard reads by executive roles are persisted.
/// </summary>
public sealed class AuditLogMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<AuditLogMiddleware> _logger;

    public AuditLogMiddleware(RequestDelegate next, ILogger<AuditLogMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext ctx, IDbConnectionFactory dbFactory)
    {
        await _next(ctx);

        // Only log if authenticated and the response was 2xx/3xx
        if (ctx.User?.Identity?.IsAuthenticated != true) return;
        if (ctx.Response.StatusCode >= 400) return;

        // Skip noise endpoints
        var path = ctx.Request.Path.Value ?? "";
        if (path.StartsWith("/health", StringComparison.OrdinalIgnoreCase)) return;
        if (path.StartsWith("/swagger", StringComparison.OrdinalIgnoreCase)) return;

        try
        {
            var userId = ctx.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "(unknown)";
            var name   = ctx.User.FindFirstValue("name") ?? "";
            var ip     = ctx.Connection.RemoteIpAddress?.ToString() ?? "";
            var ua     = ctx.Request.Headers.UserAgent.ToString();
            var eventType = ctx.Request.Method == "GET"
                ? "DATA_VIEW"
                : ctx.Request.Method.ToUpperInvariant();

            using var conn = await dbFactory.OpenAsync();
            await conn.ExecuteAsync(@"
                INSERT INTO audit.Event (UserKey, EventType, EntityType, EntityId, ClientIp, DeviceInfo, TraceId, OccurredAt)
                SELECT u.UserKey, @EventType, @EntityType, @EntityId, @ClientIp, @DeviceInfo, @TraceId, SYSUTCDATETIME()
                FROM dim.[User] u WHERE u.EntraObjectId = TRY_CONVERT(uniqueidentifier, @UserId);",
                new
                {
                    UserId      = userId,
                    EventType   = eventType,
                    EntityType  = "Endpoint",
                    EntityId    = path,
                    ClientIp    = ip,
                    DeviceInfo  = ua.Length > 400 ? ua[..400] : ua,
                    TraceId     = ctx.TraceIdentifier,
                });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to write audit log entry");
        }
    }
}
