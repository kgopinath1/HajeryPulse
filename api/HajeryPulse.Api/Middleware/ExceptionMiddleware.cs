using System.Net;
using System.Text.Json;

namespace HajeryPulse.Api.Middleware;

/// <summary>
/// Catches unhandled exceptions and returns a consistent error envelope:
/// { error: { code, message, traceId } }
/// </summary>
public sealed class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext ctx)
    {
        try
        {
            await _next(ctx);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception while processing {Method} {Path}", ctx.Request.Method, ctx.Request.Path);

            ctx.Response.ContentType = "application/json";
            ctx.Response.StatusCode  = ex switch
            {
                UnauthorizedAccessException  => (int)HttpStatusCode.Unauthorized,
                ArgumentException            => (int)HttpStatusCode.BadRequest,
                KeyNotFoundException         => (int)HttpStatusCode.NotFound,
                _                            => (int)HttpStatusCode.InternalServerError,
            };

            var payload = new
            {
                error = new
                {
                    code     = ex.GetType().Name,
                    message  = ex is ArgumentException || ex is KeyNotFoundException
                        ? ex.Message
                        : "An unexpected error occurred. Reference the trace ID for support.",
                    traceId  = ctx.TraceIdentifier,
                },
            };
            await ctx.Response.WriteAsync(JsonSerializer.Serialize(payload));
        }
    }
}
