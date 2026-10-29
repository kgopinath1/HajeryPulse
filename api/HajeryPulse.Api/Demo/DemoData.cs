using System.Globalization;

namespace HajeryPulse.Api.Demo;

/// <summary>
/// Deterministic sample-data generator for the demo (App Store review) account.
///
/// Every figure is derived from a daily revenue curve per business line —
/// weekday pattern × gentle seasonality × ~7%/yr growth × stable per-day noise —
/// summed over the same period windows the stored procedures use (day, week
/// from Sunday, month to date, year to date). The same inputs always return
/// the same numbers, totals agree across screens, and drill-down children are
/// split so they add up exactly to their parent.
/// </summary>
internal static class DemoData
{
    // ---------------------------------------------------------------- lines

    /// <summary>A business line: average daily KWD and a Sun..Sat weekday shape.</summary>
    internal sealed record Line(string Key, double BaseDaily, double[] Weekday);

    // Kuwait working week is Sun–Thu, so B2B (wholesale/tender) dips Fri/Sat
    // while restaurants and pharmacies peak at the weekend.
    internal static readonly Line Wholesale = new("wt-w", 52_000, new[] { 1.10, 1.08, 1.05, 1.04, 1.02, 0.55, 0.70 });
    internal static readonly Line Tender    = new("wt-t", 31_000, new[] { 1.15, 1.10, 1.08, 1.05, 1.00, 0.40, 0.60 });
    internal static readonly Line FB        = new("fb",   42_000, new[] { 0.92, 0.90, 0.93, 0.98, 1.12, 1.25, 1.15 });
    internal static readonly Line Pharma    = new("ph",   28_000, new[] { 0.98, 0.97, 0.97, 1.00, 1.05, 1.10, 1.03 });

    internal static Line[] WtLines(string bt) => bt?.ToLowerInvariant() switch
    {
        "wholesale" => new[] { Wholesale },
        "tender"    => new[] { Tender },
        _           => new[] { Wholesale, Tender },
    };

    // --------------------------------------------------------------- inputs

    internal static DateOnly ParseDate(string? asOfDate) =>
        DateOnly.TryParse(asOfDate, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
            ? d
            : DateOnly.FromDateTime(DateTime.UtcNow.AddHours(3)); // Kuwait time

    internal static string NormalizePeriod(string? period) => period?.ToLowerInvariant() switch
    {
        "day" => "day",
        "month" => "month",
        "ytd" or "year" => "ytd",
        _ => "week",
    };

    /// <summary>Matches the app's getPeriodLabel: DoD / WoW / MoM / YoY.</summary>
    internal static string GrowthType(string period) => NormalizePeriod(period) switch
    {
        "day" => "DoD",
        "month" => "MoM",
        "ytd" => "YoY",
        _ => "WoW",
    };

    // -------------------------------------------------------------- windows

    /// <summary>Current period window ending on the as-of date (week starts Sunday).</summary>
    internal static (DateOnly Start, DateOnly End) Window(DateOnly d, string period) => NormalizePeriod(period) switch
    {
        "day" => (d, d),
        "month" => (new DateOnly(d.Year, d.Month, 1), d),
        "ytd" => (new DateOnly(d.Year, 1, 1), d),
        _ => (d.AddDays(-(int)d.DayOfWeek), d),
    };

    /// <summary>The comparison window the growth chip compares against (same elapsed days).</summary>
    internal static (DateOnly Start, DateOnly End) PreviousWindow(DateOnly d, string period)
    {
        var (start, end) = Window(d, period);
        return NormalizePeriod(period) switch
        {
            "day" => (d.AddDays(-1), d.AddDays(-1)),
            "week" => (start.AddDays(-7), end.AddDays(-7)),
            "month" => (start.AddMonths(-1), ClampToMonth(start.AddMonths(-1), end.Day)),
            _ => (start.AddYears(-1), end.AddYears(-1)),
        };
    }

    internal static (DateOnly Start, DateOnly End) LastYearWindow(DateOnly d, string period)
    {
        var (start, end) = Window(d, period);
        return (start.AddYears(-1), end.AddYears(-1));
    }

    private static DateOnly ClampToMonth(DateOnly monthStart, int day) =>
        new(monthStart.Year, monthStart.Month, Math.Min(day, DateTime.DaysInMonth(monthStart.Year, monthStart.Month)));

    // -------------------------------------------------------------- revenue

    internal static double Daily(Line line, DateOnly day)
    {
        var season = 1 + 0.06 * Math.Sin(2 * Math.PI * (day.DayOfYear - 30) / 365.0);
        var growth = Math.Pow(1.07, (day.DayNumber - new DateOnly(2026, 1, 1).DayNumber) / 365.0);
        return line.BaseDaily * line.Weekday[(int)day.DayOfWeek] * season * growth * Noise($"{line.Key}|{day:yyyyMMdd}", 0.12);
    }

    internal static double Sum(IEnumerable<Line> lines, (DateOnly Start, DateOnly End) w)
    {
        double total = 0;
        foreach (var line in lines)
            for (var day = w.Start; day <= w.End; day = day.AddDays(1))
                total += Daily(line, day);
        return total;
    }

    internal sealed record Stats(double Current, double Previous, double LastYear)
    {
        public double GrowthPct => Change(Current, Previous);
        public double YoyPct => Change(Current, LastYear);
    }

    internal static Stats Revenue(IEnumerable<Line> lines, DateOnly d, string period)
    {
        var l = lines.ToArray();
        return new Stats(Sum(l, Window(d, period)), Sum(l, PreviousWindow(d, period)), Sum(l, LastYearWindow(d, period)));
    }

    /// <summary>
    /// Sparkline buckets in the shape the app expects (see mobile utils/labels.ts):
    /// week → one value per elapsed day from Sunday; month → W1..Wn weekly sums;
    /// ytd → one value per elapsed month; day → a single value.
    /// </summary>
    internal static List<(DateOnly Start, DateOnly End)> Buckets(DateOnly d, string period)
    {
        var (start, end) = Window(d, period);
        var buckets = new List<(DateOnly, DateOnly)>();
        switch (NormalizePeriod(period))
        {
            case "week":
                for (var day = start; day <= end; day = day.AddDays(1)) buckets.Add((day, day));
                break;
            case "month":
                for (var s = start; s <= end; s = s.AddDays(7))
                    buckets.Add((s, s.AddDays(6) < end ? s.AddDays(6) : end));
                break;
            case "ytd":
                for (var m = 1; m <= end.Month; m++)
                {
                    var ms = new DateOnly(end.Year, m, 1);
                    var me = m == end.Month ? end : ms.AddMonths(1).AddDays(-1);
                    buckets.Add((ms, me));
                }
                break;
            default:
                buckets.Add((start, end));
                break;
        }
        return buckets;
    }

    /// <summary>Shifts a bucket to its "last period" counterpart, matching PreviousWindow.</summary>
    internal static (DateOnly Start, DateOnly End) ShiftBack((DateOnly Start, DateOnly End) b, string period) =>
        NormalizePeriod(period) switch
        {
            "day" => (b.Start.AddDays(-1), b.End.AddDays(-1)),
            "week" => (b.Start.AddDays(-7), b.End.AddDays(-7)),
            "month" => (b.Start.AddMonths(-1), b.End.AddMonths(-1)),
            _ => (b.Start.AddYears(-1), b.End.AddYears(-1)),
        };

    internal static (decimal[] Current, decimal[] Previous) Trend(IEnumerable<Line> lines, DateOnly d, string period, double share = 1.0)
    {
        var l = lines.ToArray();
        var buckets = Buckets(d, period);
        return (
            buckets.Select(b => Kwd(Sum(l, b) * share)).ToArray(),
            buckets.Select(b => Kwd(Sum(l, ShiftBack(b, period)) * share)).ToArray());
    }

    /// <summary>A ratio (e.g. margin %) that drifts gently around a base value per bucket.</summary>
    internal static (decimal[] Current, decimal[] Previous) RatioTrend(string key, DateOnly d, string period, double basePct, double previousBasePct)
    {
        var buckets = Buckets(d, period);
        return (
            buckets.Select(b => Pct(basePct * Noise($"{key}|{b.Start:yyyyMMdd}", 0.04))).ToArray(),
            buckets.Select(b => Pct(previousBasePct * Noise($"{key}|prev|{b.Start:yyyyMMdd}", 0.04))).ToArray());
    }

    // --------------------------------------------------------------- splits

    /// <summary>
    /// Splits a total across named parts by weight, with a little period-stable
    /// noise so rankings shift slightly between dates. Parts always sum to total.
    /// </summary>
    internal static double[] Split(double total, IReadOnlyList<double> weights, string salt)
    {
        var w = weights.Select((x, i) => x * Noise($"{salt}|{i}", 0.10)).ToArray();
        var sum = w.Sum();
        return w.Select(x => sum == 0 ? 0 : total * x / sum).ToArray();
    }

    /// <summary>A per-entity growth offset around the parent's growth, in percentage points.</summary>
    internal static double Offset(string key, double spreadPp) => (Noise(key, 1.0) - 1.0) * spreadPp;

    /// <summary>Salt that changes with the as-of date and period, for Split/Offset.</summary>
    internal static string Salt(DateOnly d, string period, params string?[] parts) =>
        $"{d:yyyyMMdd}|{NormalizePeriod(period)}|{string.Join('|', parts)}";

    // -------------------------------------------------------------- helpers

    internal static double Change(double current, double previous) =>
        previous == 0 ? 0 : (current - previous) / previous * 100;

    internal static decimal Kwd(double v) => Math.Round((decimal)v, 3);
    internal static decimal Pct(double v) => Math.Round((decimal)v, 1);

    /// <summary>Stable multiplicative noise in [1 - spread, 1 + spread].</summary>
    internal static double Noise(string key, double spread) => 1 + (Unit(key) * 2 - 1) * spread;

    /// <summary>
    /// Stable value in [0, 1) — FNV-1a, since string.GetHashCode is randomized
    /// per process, followed by the MurmurHash3 finalizer so keys that differ
    /// only in their last characters (e.g. consecutive dates) don't land close together.
    /// </summary>
    internal static double Unit(string key)
    {
        ulong hash = 14695981039346656037;
        foreach (var c in key)
        {
            hash ^= c;
            hash *= 1099511628211;
        }
        hash ^= hash >> 33;
        hash *= 0xff51afd7ed558ccd;
        hash ^= hash >> 33;
        hash *= 0xc4ceb9fe1a85ec53;
        hash ^= hash >> 33;
        return (hash >> 11) / (double)(1UL << 53);
    }
}
