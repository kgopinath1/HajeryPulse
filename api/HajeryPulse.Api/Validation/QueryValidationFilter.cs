using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace HajeryPulse.Api.Validation;

/// <summary>
/// Server-side allow-list/format validation for query parameters shared
/// across the reporting controllers. The mobile app only ever sends values
/// from its own fixed UI (period tabs, business-type filter, etc.), but the
/// backend can't rely on that — any request can bypass the app entirely, so
/// these checks run independent of what the client claims to send.
///
/// Applied globally (see Program.cs) so every action gets it automatically —
/// action-argument names are matched by convention rather than requiring
/// each controller to opt in individually.
/// </summary>
public sealed class QueryValidationFilter : IActionFilter
{
    private static readonly HashSet<string> ValidPeriods = new(StringComparer.OrdinalIgnoreCase)
    {
        "day", "week", "month", "ytd",
    };

    private static readonly HashSet<string> ValidBusinessTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "both", "wholesale", "tender",
    };

    private static readonly HashSet<string> ValidFbScopeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "all", "brand", "outlet",
    };

    private const int MaxStringLength = 200;

    public void OnActionExecuting(ActionExecutingContext context)
    {
        foreach (var (name, value) in context.ActionArguments)
        {
            string? error = (name, value) switch
            {
                ("period", string s) when !ValidPeriods.Contains(s)
                    => "period must be one of day, week, month, ytd.",
                ("bt", string s) when !ValidBusinessTypes.Contains(s)
                    => "bt must be one of both, wholesale, tender.",
                ("scopeType", string s) when !ValidFbScopeTypes.Contains(s)
                    => "scopeType must be one of all, brand, outlet.",
                ("asOfDate", string s) when !DateTime.TryParse(
                    s, CultureInfo.InvariantCulture, DateTimeStyles.None, out _)
                    => "asOfDate must be a valid date.",
                ("limit", int n) when n < 1 || n > 100
                    => "limit must be between 1 and 100.",
                (_, string s) when s.Length > MaxStringLength
                    => $"{name} exceeds the maximum allowed length.",
                _ => null,
            };

            if (error != null)
            {
                context.Result = new BadRequestObjectResult(new
                {
                    error = new { code = "INVALID_PARAMETER", message = error },
                });
                return;
            }
        }
    }

    public void OnActionExecuted(ActionExecutedContext context) { }
}