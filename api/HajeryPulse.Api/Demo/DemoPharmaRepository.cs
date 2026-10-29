using HajeryPulse.Api.Data.Repositories;
using HajeryPulse.Api.Models.Dto;
using static HajeryPulse.Api.Demo.DemoData;

namespace HajeryPulse.Api.Demo;

/// <summary>Pharmacies sample data for the demo account. All pharmacy names are invented.</summary>
public sealed class DemoPharmaRepository : IPharmaRepository
{
    private static readonly double[] PharmacyWeights = { 1.00, 0.88, 0.80, 0.72, 0.66, 0.58, 0.50, 0.42 };

    private static readonly (string Key, string Label, string Color, double Weight)[] PaymentTypes =
    {
        ("knet",      "KNET",        "#4C8BF5", 0.46),
        ("insurance", "Insurance",   "#2EB67D", 0.22),
        ("card",      "Credit Card", "#C8B35A", 0.19),
        ("cash",      "Cash",        "#9B59B6", 0.13),
    };

    // Prescription is the Rx share; the rest split the OTC share.
    private static readonly (string Key, string Label, double Weight)[] OtcCategories =
    {
        ("otc",      "OTC Medicines",          0.34),
        ("personal", "Personal Care",          0.24),
        ("vitamins", "Vitamins & Supplements", 0.18),
        ("baby",     "Baby & Mother",          0.14),
        ("devices",  "Medical Devices",        0.10),
    };

    private const double BasketKwd = 9.6;
    private const double RxShare = 0.52;

    private static string Id(int i) => $"PH{i + 1:00}";
    private static string Name(int i) => $"Pharmacy {i + 1:00}";

    public Task<IEnumerable<PharmacyDto>> ListPharmacies(string asOfDate, string period = "week")
    {
        var d = ParseDate(asOfDate);
        IEnumerable<PharmacyDto> rows = Amounts(d, period)
            .Select((amt, i) => new PharmacyDto(Id(i), Name(i), Kwd(amt)))
            .ToArray();
        return Task.FromResult(rows);
    }

    public Task<PharmaSummaryDto> GetSummary(string asOfDate, string pharmacyId, string period = "week")
    {
        var d = ParseDate(asOfDate);
        var (rev, share, idx) = Scoped(pharmacyId, d, period);
        var key = Salt(d, period, pharmacyId);

        var revenue = rev.Current * share;
        var basket = BasketKwd * Noise(key + "|basket", 0.05);
        var basketPrev = BasketKwd * Noise(key + "|basketp", 0.05);
        var txns = revenue / basket;
        var txnsPrev = rev.Previous * share / basketPrev;

        var pharmacy = idx < 0
            ? new PharmacyDto("all", "All Pharmacies", Kwd(revenue))
            : new PharmacyDto(Id(idx), Name(idx), Kwd(revenue));
        var stores = idx < 0 ? PharmacyWeights.Length : 1;

        return Task.FromResult(new PharmaSummaryDto(
            pharmacy,
            RevenueKwd: Kwd(revenue),
            Transactions: (int)Math.Round(txns),
            DeltaTxns: Pct(Change(txns, txnsPrev)),
            PrevBasketSizeKwd: Kwd(basketPrev),
            DeltaBasketSizeKwd: Pct(Change(basket, basketPrev)),
            BasketSizeKwd: Kwd(basket),
            StoresActive: stores,
            StoresTotal: stores,
            GrowthPct: Pct(rev.GrowthPct + Offset(key + "|g", idx < 0 ? 0 : 6)),
            GrowthType: GrowthType(period),
            YoyPct: Pct(rev.YoyPct + Offset(key + "|y", idx < 0 ? 0 : 6))));
    }

    public Task<PharmaMarginDto> GetMargin(string asOfDate, string pharmacyId, string period = "week")
    {
        var d = ParseDate(asOfDate);
        var (rev, share, _) = Scoped(pharmacyId, d, period);
        var key = Salt(d, period, pharmacyId);

        var net = rev.Current * share;
        var netPrev = rev.Previous * share;
        var discountPct = 4.2 * Noise(key + "|disc", 0.15);
        var gross = net / (1 - discountPct / 100);
        var grossPrev = netPrev / (1 - 4.2 / 100);
        var marginPct = 31.5 * Noise(key + "|m", 0.04);
        var marginPrev = 31.5 * Noise(key + "|mp", 0.04);
        var cogs = net * (1 - marginPct / 100);
        var cogsPrev = netPrev * (1 - marginPrev / 100);
        var (trend, trendLY) = RatioTrend($"ph-margin|{pharmacyId}", d, period, marginPct, marginPrev);

        return Task.FromResult(new PharmaMarginDto(
            GrossKwd: Kwd(gross),
            DiscountKwd: Kwd(gross - net),
            CogsKwd: Kwd(cogs),
            MarginKwd: Kwd(net - cogs),
            NetSalesKwd: Kwd(net),
            MarginPct: Pct(marginPct),
            MarginPctLY: Pct(marginPrev),
            MarginDeviationPp: Pct(marginPct - marginPrev),
            LyGrossKwd: Kwd(grossPrev),
            LyNetSalesKwd: Kwd(netPrev),
            LyCogsKwd: Kwd(cogsPrev),
            GrossYoyPct: Pct(Change(gross, grossPrev)),
            CogsYoyPct: Pct(Change(cogs, cogsPrev)),
            GrossMarginYoyPct: Pct(Change(net - cogs, netPrev - cogsPrev)),
            DiscountPct: Pct(discountPct),
            GrowthType: GrowthType(period),
            Trend: trend,
            TrendLY: trendLY));
    }

    public Task<PharmaSalesQualityDto> GetQuality(string asOfDate, string pharmacyId, string period = "week")
    {
        var d = ParseDate(asOfDate);
        var (rev, share, _) = Scoped(pharmacyId, d, period);
        var key = Salt(d, period, pharmacyId);

        var net = rev.Current * share;
        var returnsPct = 1.6 * Noise(key + "|ret", 0.2);
        var returnsPrev = 1.6 * Noise(key + "|retp", 0.2);
        var cancelPct = 0.5 * Noise(key + "|can", 0.3);
        var gross = net / (1 - (returnsPct + cancelPct) / 100);
        var netPct = net / gross * 100;
        var netPctPrev = 100 - returnsPrev - cancelPct;

        return Task.FromResult(new PharmaSalesQualityDto(
            GrossKwd: Kwd(gross),
            ReturnsKwd: Kwd(gross * returnsPct / 100),
            CancellationsKwd: Kwd(gross * cancelPct / 100),
            NetKwd: Kwd(net),
            NetPct: Pct(netPct),
            ReturnsPct: Pct(returnsPct),
            ReturnsPctPrev: Pct(returnsPrev),
            GrowthType: GrowthType(period),
            ReturnsPctPp: Pct(returnsPct - returnsPrev),
            NetPctPp: Pct(netPct - netPctPrev)));
    }

    public Task<List<PharmaChannelDto>> GetChannels(string asOfDate, string pharmacyId, string period = "week")
    {
        var d = ParseDate(asOfDate);
        var (rev, share, _) = Scoped(pharmacyId, d, period);
        var revenue = rev.Current * share;
        var parts = Split(revenue, new[] { 0.68, 0.21, 0.11 }, Salt(d, period, pharmacyId, "chan"));

        var rows = new[] { ("WALKIN", "Walk-in"), ("DELIVERY", "Home Delivery"), ("ONLINE", "Online / App") }
            .Select((c, i) => new PharmaChannelDto(c.Item1, c.Item2, Kwd(parts[i]), Pct(revenue == 0 ? 0 : parts[i] / revenue * 100)))
            .OrderByDescending(c => c.Kwd)
            .ToList();
        return Task.FromResult(rows);
    }

    public Task<IEnumerable<PharmaPaymentDto>> GetPayments(string asOfDate, string pharmacyId, string period = "week")
    {
        var d = ParseDate(asOfDate);
        var (rev, share, _) = Scoped(pharmacyId, d, period);
        var revenue = rev.Current * share;
        var parts = Split(revenue, PaymentTypes.Select(p => p.Weight).ToArray(), Salt(d, period, pharmacyId, "pay"));

        IEnumerable<PharmaPaymentDto> rows = PaymentTypes
            .Select((p, i) => new PharmaPaymentDto(p.Key, p.Label, Kwd(parts[i]), Pct(revenue == 0 ? 0 : parts[i] / revenue * 100), p.Color))
            .OrderByDescending(p => p.Kwd)
            .ToArray();
        return Task.FromResult(rows);
    }

    public Task<IEnumerable<PharmaCategoryDto>> GetCategories(string asOfDate, string pharmacyId, string period = "week")
    {
        var d = ParseDate(asOfDate);
        var (rev, share, _) = Scoped(pharmacyId, d, period);
        var revenue = rev.Current * share;
        var rx = revenue * RxSharePct(d, period, pharmacyId) / 100;
        var otc = Split(revenue - rx, OtcCategories.Select(c => c.Weight).ToArray(), Salt(d, period, pharmacyId, "cat"));

        IEnumerable<PharmaCategoryDto> rows = new[] { new PharmaCategoryDto("rx", "Prescription", Kwd(rx), Pct(revenue == 0 ? 0 : rx / revenue * 100)) }
            .Concat(OtcCategories.Select((c, i) => new PharmaCategoryDto(c.Key, c.Label, Kwd(otc[i]), Pct(revenue == 0 ? 0 : otc[i] / revenue * 100))))
            .OrderByDescending(c => c.Kwd)
            .ToArray();
        return Task.FromResult(rows);
    }

    public Task<PharmaRxOtcMixDto> GetRxOtcMix(string asOfDate, string pharmacyId, string period = "week")
    {
        var d = ParseDate(asOfDate);
        var (rev, share, _) = Scoped(pharmacyId, d, period);
        var revenue = rev.Current * share;
        var previous = rev.Previous * share;
        var rxPct = RxSharePct(d, period, pharmacyId);
        var rxPctPrev = RxShare * 100 * Noise(Salt(d, period, pharmacyId, "rxp"), 0.03);

        var rx = revenue * rxPct / 100;
        var rxPrev = previous * rxPctPrev / 100;

        return Task.FromResult(new PharmaRxOtcMixDto(
            RxPct: Pct(rxPct),
            OtcPct: Pct(100 - rxPct),
            RxKwd: Kwd(rx),
            OtcKwd: Kwd(revenue - rx),
            RxYoyPp: Pct(rxPct - rxPctPrev),
            RxYoyPct: Pct(Change(rx, rxPrev)),
            OtcYoyPct: Pct(Change(revenue - rx, previous - rxPrev)),
            GrowthType: GrowthType(period)));
    }

    public Task<IEnumerable<PharmaDiscountDto>> GetDiscountLeaderboard(string asOfDate, int limit, string period = "week")
    {
        var d = ParseDate(asOfDate);
        IEnumerable<PharmaDiscountDto> rows = Amounts(d, period)
            .Select((amt, i) =>
            {
                var rate = 2.5 + Unit(Salt(d, period, Id(i), "disc")) * 6.5;
                return new PharmaDiscountDto(Id(i), Name(i), Pct(rate), Kwd(amt / (1 - rate / 100) - amt));
            })
            .OrderByDescending(r => r.RatePct)
            .Take(Math.Max(1, limit))
            .ToArray();
        return Task.FromResult(rows);
    }

    public Task<IEnumerable<PharmacyDto>> GetTopPharmacies(string asOfDate, int limit, string period = "week")
    {
        var d = ParseDate(asOfDate);
        IEnumerable<PharmacyDto> rows = Amounts(d, period)
            .Select((amt, i) => new PharmacyDto(Id(i), Name(i), Kwd(amt)))
            .OrderByDescending(p => p.AmtKwd)
            .Take(Math.Max(1, limit))
            .ToArray();
        return Task.FromResult(rows);
    }

    public Task<PharmaTrendDto> GetTrend(string asOfDate, string pharmacyId, string period = "week")
    {
        var d = ParseDate(asOfDate);
        var (_, share, _) = Scoped(pharmacyId, d, period);
        var (current, previous) = Trend(new[] { Pharma }, d, period, share);
        return Task.FromResult(new PharmaTrendDto(current, previous));
    }

    // -------------------------------------------------------------- helpers

    private static double[] Amounts(DateOnly d, string period) =>
        Split(Revenue(new[] { Pharma }, d, period).Current, PharmacyWeights, Salt(d, period, "pharmacies"));

    /// <summary>Pharmacy-line stats, the selected pharmacy's share (1 for "all"), and its index (-1 for "all").</summary>
    private static (Stats Rev, double Share, int Index) Scoped(string? pharmacyId, DateOnly d, string period)
    {
        var rev = Revenue(new[] { Pharma }, d, period);
        var idx = Enumerable.Range(0, PharmacyWeights.Length).FirstOrDefault(i => Id(i) == pharmacyId, -1);
        if (idx < 0 || rev.Current == 0) return (rev, 1, -1);
        return (rev, Amounts(d, period)[idx] / rev.Current, idx);
    }

    private static double RxSharePct(DateOnly d, string period, string? pharmacyId) =>
        RxShare * 100 * Noise(Salt(d, period, pharmacyId, "rx"), 0.04);
}
