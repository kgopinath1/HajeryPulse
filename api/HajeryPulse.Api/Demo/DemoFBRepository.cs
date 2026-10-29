using HajeryPulse.Api.Data.Repositories;
using HajeryPulse.Api.Models.Dto;
using static HajeryPulse.Api.Demo.DemoData;

namespace HajeryPulse.Api.Demo;

/// <summary>Food &amp; Beverage sample data for the demo account. All brand/outlet names are invented.</summary>
public sealed class DemoFBRepository : IFBRepository
{
    private static readonly (string Id, string Name, string Color, double Weight, int Outlets, double DeliveryShare)[] Brands =
    {
        ("DB1", "Demo Café",   "#C8B35A", 0.24, 6, 0.22),
        ("DB2", "Demo Grill",  "#4C8BF5", 0.21, 5, 0.38),
        ("DB3", "Demo Pizza",  "#E8743B", 0.18, 5, 0.52),
        ("DB4", "Demo Burger", "#2EB67D", 0.16, 4, 0.47),
        ("DB5", "Demo Bakery", "#9B59B6", 0.12, 4, 0.18),
        ("DB6", "Demo Sushi",  "#E5484D", 0.09, 3, 0.41),
    };

    private static readonly (string Key, string Label, string Color, double Weight)[] Aggregators =
    {
        ("app_a", "Delivery App A", "#E8743B", 0.46),
        ("app_b", "Delivery App B", "#4C8BF5", 0.27),
        ("app_c", "Delivery App C", "#2EB67D", 0.15),
        ("own",   "Own Delivery",   "#C8B35A", 0.12),
    };

    private static readonly (string Key, string Label, string Color, double Weight)[] PaymentTypes =
    {
        ("knet",   "KNET",          "#4C8BF5", 0.44),
        ("card",   "Credit Card",   "#C8B35A", 0.23),
        ("online", "Online / App",  "#2EB67D", 0.21),
        ("cash",   "Cash",          "#9B59B6", 0.12),
    };

    private const double TicketKwd = 7.4;

    private sealed record Outlet(string Code, string Name, int BrandIndex);

    private static readonly Outlet[] AllOutlets = Brands
        .SelectMany((b, bi) => Enumerable.Range(1, b.Outlets)
            .Select(j => new Outlet($"{b.Id}-O{j}", $"{b.Name} · Outlet {j}", bi)))
        .ToArray();

    // ---------------------------------------------------------------- lists

    public Task<IEnumerable<FBBrandDto>> ListBrands(string asOfDate, string period = "week")
    {
        var d = ParseDate(asOfDate);
        var rev = Revenue(new[] { FB }, d, period);
        var amounts = BrandAmounts(d, period, rev.Current);
        IEnumerable<FBBrandDto> rows = Brands.Select((b, i) => BrandDto(i, amounts[i], rev, d, period)).ToArray();
        return Task.FromResult(rows);
    }

    public Task<IEnumerable<FBOutletDto>> ListOutlets(string asOfDate, string scopeType = "all", string? scopeId = null, string period = "week")
    {
        var d = ParseDate(asOfDate);
        var rev = Revenue(new[] { FB }, d, period);
        var brandIdx = scopeType == "brand" ? BrandIndex(scopeId) : -1;
        IEnumerable<FBOutletDto> rows = OutletRows(d, period, rev)
            .Where(o => brandIdx < 0 || o.Outlet.BrandIndex == brandIdx)
            .Select(o => OutletDto(o.Outlet, o.Amt, rev, d, period))
            .ToArray();
        return Task.FromResult(rows);
    }

    // -------------------------------------------------------------- summary

    public Task<FBSummaryDto> GetSummary(string asOfDate, string scopeType, string? scopeId, string period)
    {
        var d = ParseDate(asOfDate);
        var (scope, share, outletsTotal) = Scope(scopeType, scopeId, d, period);
        var rev = Revenue(new[] { FB }, d, period);
        var key = Salt(d, period, scopeType, scopeId);

        var revenue = rev.Current * share;
        var ticket = TicketKwd * Noise(key + "|ticket", 0.06);
        var ticketPrev = TicketKwd * Noise(key + "|ticketp", 0.06);
        var covers = revenue / ticket;
        var coversPrev = rev.Previous * share / ticketPrev;

        return Task.FromResult(new FBSummaryDto(
            scope,
            RevenueKwd: Kwd(revenue),
            Covers: (int)Math.Round(covers),
            CoversDelta: Pct(Change(covers, coversPrev)),
            TicketKwd: Kwd(ticket),
            TicketKwdDelta: Pct(Change(ticket, ticketPrev)),
            OutletsActive: Math.Max(1, outletsTotal - (outletsTotal > 4 && Unit(key + "|closed") > 0.7 ? 1 : 0)),
            OutletsTotal: outletsTotal,
            GrowthPct: Pct(rev.GrowthPct + Offset(key + "|g", scopeType == "all" ? 0 : 6)),
            GrowthType: GrowthType(period),
            YoyPct: Pct(rev.YoyPct + Offset(key + "|y", scopeType == "all" ? 0 : 6))));
    }

    public Task<IEnumerable<FBBrandDto>> GetBrandSummary(string asOfDate, string scopeType, string? scopeId, string period)
    {
        var d = ParseDate(asOfDate);
        var rev = Revenue(new[] { FB }, d, period);
        var amounts = BrandAmounts(d, period, rev.Current);

        IEnumerable<FBBrandDto> rows = scopeType switch
        {
            "brand" when BrandIndex(scopeId) is var bi and >= 0 => new[] { BrandDto(bi, amounts[bi], rev, d, period) },
            "outlet" when OutletRows(d, period, rev).FirstOrDefault(o => o.Outlet.Code == scopeId) is { Outlet: not null } o =>
                new[] { BrandDto(o.Outlet.BrandIndex, o.Amt, rev, d, period) with { OutletCount = 1 } },
            _ => Brands.Select((_, i) => BrandDto(i, amounts[i], rev, d, period)).OrderByDescending(b => b.AmtKwd).ToArray(),
        };
        return Task.FromResult(rows);
    }

    public Task<IEnumerable<FBAggregatorDto>> GetAggregators(string asOfDate, string scopeType, string? scopeId, string period)
    {
        var d = ParseDate(asOfDate);
        var (_, share, _) = Scope(scopeType, scopeId, d, period);
        var delivery = Revenue(new[] { FB }, d, period).Current * share * DeliveryShare(scopeType, scopeId);
        var parts = Split(delivery, Aggregators.Select(a => a.Weight).ToArray(), Salt(d, period, scopeType, scopeId, "agg"));

        IEnumerable<FBAggregatorDto> rows = Aggregators
            .Select((a, i) => new FBAggregatorDto(a.Key, a.Label, Kwd(parts[i]), Pct(delivery == 0 ? 0 : parts[i] / delivery * 100), a.Color))
            .OrderByDescending(a => a.Kwd)
            .ToArray();
        return Task.FromResult(rows);
    }

    public Task<IEnumerable<FBPaymentDto>> GetPayments(string asOfDate, string scopeType, string? scopeId, string period)
    {
        var d = ParseDate(asOfDate);
        var (_, share, _) = Scope(scopeType, scopeId, d, period);
        var revenue = Revenue(new[] { FB }, d, period).Current * share;
        var parts = Split(revenue, PaymentTypes.Select(p => p.Weight).ToArray(), Salt(d, period, scopeType, scopeId, "pay"));

        IEnumerable<FBPaymentDto> rows = PaymentTypes
            .Select((p, i) => new FBPaymentDto(p.Key, p.Label, Kwd(parts[i]), Pct(revenue == 0 ? 0 : parts[i] / revenue * 100), p.Color))
            .OrderByDescending(p => p.Kwd)
            .ToArray();
        return Task.FromResult(rows);
    }

    public Task<List<FBChannelMixDto>> GetChannels(string asOfDate, string scopeType, string? scopeId, string period)
    {
        var d = ParseDate(asOfDate);
        var (_, share, _) = Scope(scopeType, scopeId, d, period);
        var revenue = Revenue(new[] { FB }, d, period).Current * share;
        var delivery = revenue * DeliveryShare(scopeType, scopeId);
        var rest = Split(revenue - delivery, new[] { 0.72, 0.28 }, Salt(d, period, scopeType, scopeId, "chan"));

        var rows = new[] { ("DINE", "Dine-in", rest[0]), ("TAKE", "Takeaway", rest[1]), ("DLV", "Delivery", delivery) }
            .Select(c => new FBChannelMixDto(c.Item1, c.Item2, Kwd(c.Item3), Pct(revenue == 0 ? 0 : c.Item3 / revenue * 100)))
            .OrderByDescending(c => c.Kwd)
            .ToList();
        return Task.FromResult(rows);
    }

    public async Task<IEnumerable<FBBrandDto>> GetDeliveryByBrand(string asOfDate, string scopeType, string? scopeId, string period)
        => (await GetBrandSummary(asOfDate, scopeType, scopeId, period)).OrderByDescending(b => b.DeliveryKwd).ToArray();

    public Task<IEnumerable<FBOutletDto>> GetTopOutlets(string asOfDate, string scopeType, string? scopeId, string period, int limit)
    {
        var d = ParseDate(asOfDate);
        var rev = Revenue(new[] { FB }, d, period);
        var brandIdx = scopeType == "brand" ? BrandIndex(scopeId) : -1;

        IEnumerable<FBOutletDto> rows = OutletRows(d, period, rev)
            .Where(o => brandIdx < 0 || o.Outlet.BrandIndex == brandIdx)
            .Where(o => scopeType != "outlet" || o.Outlet.Code == scopeId)
            .OrderByDescending(o => o.Amt)
            .Take(Math.Max(1, limit))
            .Select(o => OutletDto(o.Outlet, o.Amt, rev, d, period))
            .ToArray();
        return Task.FromResult(rows);
    }

    public Task<FBTrendDto> GetTrend(string d, string st, string? sid, string per)
    {
        var date = ParseDate(d);
        var (_, share, _) = Scope(st, sid, date, per);
        var (current, previous) = Trend(new[] { FB }, date, per, share);
        return Task.FromResult(new FBTrendDto(current, previous));
    }

    // -------------------------------------------------------------- helpers

    private static int BrandIndex(string? id) => Array.FindIndex(Brands, b => b.Id == id);

    private static double[] BrandAmounts(DateOnly d, string period, double total) =>
        Split(total, Brands.Select(b => b.Weight).ToArray(), Salt(d, period, "fb-brands"));

    private static IEnumerable<(Outlet Outlet, double Amt)> OutletRows(DateOnly d, string period, Stats rev)
    {
        var brandAmounts = BrandAmounts(d, period, rev.Current);
        foreach (var group in AllOutlets.GroupBy(o => o.BrandIndex))
        {
            var outlets = group.ToArray();
            var weights = outlets.Select((_, j) => 1.0 / (1 + j * 0.25)).ToArray();
            var amounts = Split(brandAmounts[group.Key], weights, Salt(d, period, Brands[group.Key].Id, "outlets"));
            for (var j = 0; j < outlets.Length; j++) yield return (outlets[j], amounts[j]);
        }
    }

    /// <summary>Scope DTO, share of total F&amp;B revenue, and outlet count for the selected scope.</summary>
    private static (FBScopeDto Scope, double Share, int Outlets) Scope(string scopeType, string? scopeId, DateOnly d, string period)
    {
        var rev = Revenue(new[] { FB }, d, period);
        if (rev.Current == 0) return (new FBScopeDto(scopeType, scopeId, "All"), 0, AllOutlets.Length);

        if (scopeType == "brand" && BrandIndex(scopeId) is var bi and >= 0)
            return (new FBScopeDto("brand", scopeId, Brands[bi].Name), BrandAmounts(d, period, rev.Current)[bi] / rev.Current, Brands[bi].Outlets);

        if (scopeType == "outlet" && OutletRows(d, period, rev).FirstOrDefault(o => o.Outlet.Code == scopeId) is { Outlet: not null } o)
            return (new FBScopeDto("outlet", scopeId, o.Outlet.Name), o.Amt / rev.Current, 1);

        return (new FBScopeDto("all", null, "All"), 1, AllOutlets.Length);
    }

    private static double DeliveryShare(string scopeType, string? scopeId)
    {
        var bi = scopeType switch
        {
            "brand" => BrandIndex(scopeId),
            "outlet" => AllOutlets.FirstOrDefault(o => o.Code == scopeId)?.BrandIndex ?? -1,
            _ => -1,
        };
        return bi >= 0 ? Brands[bi].DeliveryShare : 0.34;
    }

    private static FBBrandDto BrandDto(int i, double amt, Stats rev, DateOnly d, string period) => new(
        Id: Brands[i].Id,
        Name: Brands[i].Name,
        AmtKwd: Kwd(amt),
        Color: Brands[i].Color,
        OutletCount: Brands[i].Outlets,
        GrowthPct: Pct(rev.GrowthPct + Offset(Salt(d, period, Brands[i].Id, "g"), 8)),
        GrowthType: GrowthType(period),
        YoyPct: Pct(rev.YoyPct + Offset(Salt(d, period, Brands[i].Id, "y"), 8)),
        DeliveryKwd: Kwd(amt * Brands[i].DeliveryShare));

    private static FBOutletDto OutletDto(Outlet o, double amt, Stats rev, DateOnly d, string period) => new(
        Code: o.Code,
        Name: o.Name,
        BrandId: Brands[o.BrandIndex].Id,
        AmtKwd: Kwd(amt),
        GrowthPct: Pct(rev.GrowthPct + Offset(Salt(d, period, o.Code, "g"), 12)),
        GrowthType: GrowthType(period),
        YoyPct: Pct(rev.YoyPct + Offset(Salt(d, period, o.Code, "y"), 12)));
}
