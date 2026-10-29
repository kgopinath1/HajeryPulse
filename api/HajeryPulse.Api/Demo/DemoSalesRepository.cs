using HajeryPulse.Api.Data.Repositories;
using HajeryPulse.Api.Models.Dto;
using static HajeryPulse.Api.Demo.DemoData;

namespace HajeryPulse.Api.Demo;

/// <summary>Wholesale &amp; Tender sample data for the demo account. All names are invented.</summary>
public sealed class DemoSalesRepository : ISalesRepository
{
    // Org tree: BusinessUnit → Division → BusinessType (Wholesale/Tender) → Supplier.
    // Keys are dotted paths so any node's share can be computed from the root.
    private static readonly (string Code, string Name, double Weight, (string Code, string Name, double Weight)[] Divisions)[] Units =
    {
        ("BU1", "Pharmaceuticals", 0.42, new[] { ("D1", "Prescription Medicines", 0.45), ("D2", "Generics", 0.33), ("D3", "Specialty Care", 0.22) }),
        ("BU2", "Consumer Health", 0.28, new[] { ("D1", "Personal Care", 0.55), ("D2", "Nutrition", 0.45) }),
        ("BU3", "Medical Supplies", 0.30, new[] { ("D1", "Hospital Consumables", 0.40), ("D2", "Diagnostics", 0.35), ("D3", "Surgical", 0.25) }),
    };

    private const int SuppliersPerType = 6;

    private static readonly (string Code, string Name, string Segment, double Weight)[] Brands =
    {
        ("BRA", "Brand A", "Prescription", 1.00), ("BRB", "Brand B", "Generics", 0.86),
        ("BRC", "Brand C", "Personal Care", 0.74), ("BRD", "Brand D", "Diagnostics", 0.66),
        ("BRE", "Brand E", "Prescription", 0.58), ("BRF", "Brand F", "Nutrition", 0.51),
        ("BRG", "Brand G", "Surgical", 0.45), ("BRH", "Brand H", "Hospital Consumables", 0.40),
        ("BRI", "Brand I", "Specialty Care", 0.34), ("BRJ", "Brand J", "Personal Care", 0.29),
        ("BRK", "Brand K", "Generics", 0.24), ("BRL", "Brand L", "Diagnostics", 0.20),
    };

    private static readonly string[] CustomerTypes = { "Hospital", "Pharmacy Chain", "Co-operative Society", "Clinic", "Government" };

    public Task<WTSummaryDto> GetSummary(string asOfDate, string bt, string period = "week")
    {
        var d = ParseDate(asOfDate);
        var lines = WtLines(bt);
        var rev = Revenue(lines, d, period);
        var (spark, sparkLY) = Trend(lines, d, period);

        var aov = 1_850 * Noise(Salt(d, period, bt, "aov"), 0.06);
        var tenderValue = 46_000 * Noise(Salt(d, period, bt, "tender"), 0.10);
        var activeTenders = bt == "wholesale" ? 0 : 12 + (int)(Unit(Salt(d, period, "tenders")) * 8);

        return Task.FromResult(new WTSummaryDto(
            asOfDate, bt, period,
            new RevenuePoint(Kwd(rev.Current), Pct(rev.GrowthPct), GrowthType(period)),
            new WTKpis(
                NewOrders: (int)Math.Round(rev.Current / aov),
                AvgOrderValueKwd: Kwd(aov),
                AvgOrderValuePct: Pct(Offset(Salt(d, period, bt, "aovpct"), 6)),
                PipelineAmount: Kwd(rev.Current * 1.8 * Noise(Salt(d, period, bt, "pipe"), 0.1)),
                ActiveTenders: activeTenders,
                AvgTenderValueKwd: Kwd(bt == "wholesale" ? 0 : tenderValue),
                AvgTenderValuePct: Pct(bt == "wholesale" ? 0 : Offset(Salt(d, period, bt, "tvpct"), 8))),
            spark, sparkLY));
    }

    public Task<MarginAnalysisDto> GetMargin(string asOfDate, string bt, string period = "week")
    {
        var d = ParseDate(asOfDate);
        var rev = Revenue(WtLines(bt), d, period);
        var basePct = bt switch { "wholesale" => 25.6, "tender" => 19.4, _ => 23.3 };

        var margin = basePct * Noise(Salt(d, period, bt, "m"), 0.03);
        var marginPrev = basePct * Noise(Salt(d, period, bt, "mp"), 0.03);
        var cogs = rev.Current * (1 - margin / 100);
        var cogsPrev = rev.Previous * (1 - marginPrev / 100);
        var (trend, trendLY) = RatioTrend($"wt-margin|{bt}", d, period, margin, marginPrev);

        return Task.FromResult(new MarginAnalysisDto(
            MarginPct: Pct(margin),
            MarginPctLY: Pct(marginPrev),
            MarginYoyPp: Pct(margin - marginPrev),
            NetSalesKwd: Kwd(rev.Current),
            CogsKwd: Kwd(cogs),
            GrossMarginKwd: Kwd(rev.Current - cogs),
            SalesYoyPct: Pct(rev.GrowthPct),
            CogsYoyPct: Pct(Change(cogs, cogsPrev)),
            GrossMarginYoyPct: Pct(Change(rev.Current - cogs, rev.Previous - cogsPrev)),
            Trend12mo: trend,
            Trend12moLY: trendLY));
    }

    public Task<SalesQualityDto> GetQuality(string asOfDate, string bt, string period = "week")
    {
        var d = ParseDate(asOfDate);
        var net = Revenue(WtLines(bt), d, period).Current;
        var returnsPct = 2.3 * Noise(Salt(d, period, bt, "ret"), 0.15);
        var returnsPrev = 2.3 * Noise(Salt(d, period, bt, "retp"), 0.15);
        var cancelPct = 0.9 * Noise(Salt(d, period, bt, "can"), 0.2);

        var gross = net / (1 - (returnsPct + cancelPct) / 100);
        var netPct = net / gross * 100;
        var netPctPrev = 100 - returnsPrev - cancelPct;

        return Task.FromResult(new SalesQualityDto(
            GrossKwd: Kwd(gross),
            ReturnsKwd: Kwd(gross * returnsPct / 100),
            CancellationsKwd: Kwd(gross * cancelPct / 100),
            NetKwd: Kwd(net),
            NetPct: Pct(netPct),
            ReturnsPct: Pct(returnsPct),
            ReturnsPctDelta: Pct(returnsPct - returnsPrev),
            CancellationsPct: Pct(cancelPct),
            NetPctDelta: Pct(netPct - netPctPrev)));
    }

    public Task<OrgNodeDto> GetOrgNode(string asOfDate, string bt, string parent, string period = "week")
    {
        var d = ParseDate(asOfDate);
        var (wTotal, tTotal) = RootTotals(d, bt, period);
        var rootYoy = Revenue(WtLines(bt), d, period).GrowthPct;
        var key = string.IsNullOrWhiteSpace(parent) ? "root" : parent;

        var (level, label, children) = ChildrenOf(key);
        var rows = children
            .Select(c =>
            {
                var (w, t) = NodeShares(c.Key, d, period);
                return (c, Amt: (W: w * wTotal, T: t * tTotal));
            })
            .Where(x => x.Amt.W + x.Amt.T > 0)
            .ToArray();
        var siblingsTotal = rows.Sum(x => x.Amt.W + x.Amt.T);

        var dto = rows
            .OrderByDescending(x => x.Amt.W + x.Amt.T)
            .Select(x => new OrgChildDto(
                Key: x.c.Key, Code: x.c.Key, Name: x.c.Name,
                AmtW: Kwd(x.Amt.W), AmtT: Kwd(x.Amt.T), Total: Kwd(x.Amt.W + x.Amt.T),
                YoyPct: Pct(rootYoy + Offset(Salt(d, period, x.c.Key, "yoy"), 8)),
                HasChildren: x.c.HasChildren ? 1 : 0,
                GrowthType: GrowthType(period),
                SharePct: Pct(siblingsTotal == 0 ? 0 : (x.Amt.W + x.Amt.T) / siblingsTotal * 100)))
            .ToArray();

        return Task.FromResult(new OrgNodeDto(level, label, key, dto));
    }

    public Task<IEnumerable<TopBrandDto>> GetTopBrands(string asOfDate, string bt, string period, int limit, string parent = "root")
    {
        var d = ParseDate(asOfDate);
        var rev = Revenue(WtLines(bt), d, period);
        var scoped = rev.Current * ScopeShare(parent, d, bt, period) * 0.68; // top brands ≈ 68% of the scope
        var amounts = Split(scoped, Brands.Select(b => b.Weight).ToArray(), Salt(d, period, bt, parent, "brands"));

        IEnumerable<TopBrandDto> rows = Brands
            .Select((b, i) => (b, Amt: amounts[i]))
            .OrderByDescending(x => x.Amt)
            .Take(Math.Clamp(limit, 1, Brands.Length))
            .Select((x, i) => new TopBrandDto(
                i + 1, x.b.Code, x.b.Name, x.b.Segment, Kwd(x.Amt),
                Pct(rev.GrowthPct + Offset(Salt(d, period, x.b.Code, "yoy"), 10)), GrowthType(period)))
            .ToArray();
        return Task.FromResult(rows);
    }

    public Task<IEnumerable<TopCustomerDto>> GetTopCustomers(string asOfDate, string bt, string period, int limit, string parent = "root")
    {
        var d = ParseDate(asOfDate);
        var rev = Revenue(WtLines(bt), d, period);
        var scoped = rev.Current * ScopeShare(parent, d, bt, period) * 0.55; // top customers ≈ 55% of the scope
        const int customers = 15;
        var weights = Enumerable.Range(0, customers).Select(i => 1.0 / (1 + i * 0.35)).ToArray();
        var amounts = Split(scoped, weights, Salt(d, period, bt, parent, "customers"));

        IEnumerable<TopCustomerDto> rows = amounts
            .Select((amt, i) => (Index: i, Amt: amt))
            .OrderByDescending(x => x.Amt)
            .Take(Math.Clamp(limit, 1, customers))
            .Select((x, rank) => new TopCustomerDto(
                rank + 1,
                $"Customer {x.Index + 1:00}",
                CustomerTypes[x.Index % CustomerTypes.Length],
                Math.Max(1, (int)Math.Round(x.Amt / (2_400 * Noise($"cust{x.Index}", 0.3)))),
                Kwd(x.Amt),
                Pct(rev.GrowthPct + Offset(Salt(d, period, $"cust{x.Index}", "yoy"), 12)),
                GrowthType(period)))
            .ToArray();
        return Task.FromResult(rows);
    }

    // ------------------------------------------------------------ org tree

    private sealed record Node(string Key, string Name, bool HasChildren);

    private static (double W, double T) RootTotals(DateOnly d, string bt, string period) => (
        bt == "tender" ? 0 : Revenue(new[] { Wholesale }, d, period).Current,
        bt == "wholesale" ? 0 : Revenue(new[] { Tender }, d, period).Current);

    /// <summary>Level of the returned children (as the app's orgLevelLabel expects), parent label, children.</summary>
    private static (string Level, string Label, Node[] Children) ChildrenOf(string key)
    {
        if (key == "root")
            return ("BusinessUnit", "All Business Units",
                Units.Select(u => new Node(u.Code, u.Name, true)).ToArray());

        var parts = key.Split('.');
        var unit = Units.FirstOrDefault(u => u.Code == parts[0]);
        if (unit.Code is null) return ("BusinessUnit", key, Array.Empty<Node>());

        if (parts.Length == 1)
            return ("Division", unit.Name,
                unit.Divisions.Select(dv => new Node($"{unit.Code}.{dv.Code}", dv.Name, true)).ToArray());

        var div = unit.Divisions.FirstOrDefault(dv => dv.Code == parts[1]);
        if (div.Code is null) return ("Division", key, Array.Empty<Node>());

        if (parts.Length == 2)
            return ("BusinessType", div.Name, new[]
            {
                new Node($"{key}.W", "Wholesale", true),
                new Node($"{key}.T", "Tender", true),
            });

        if (parts.Length == 3)
            return ("Supplier", parts[2] == "W" ? $"{div.Name} – Wholesale" : $"{div.Name} – Tender",
                Enumerable.Range(1, SuppliersPerType)
                    .Select(i => new Node($"{key}.S{i:00}", $"Supplier {SupplierNumber(key, i):00}", false))
                    .ToArray());

        return ("Supplier", key, Array.Empty<Node>());
    }

    /// <summary>Gives each division its own supplier numbers so names don't repeat across the tree.</summary>
    private static int SupplierNumber(string typeKey, int i) =>
        (int)(Unit(typeKey) * 80) + i;

    /// <summary>
    /// Fraction of the root Wholesale and Tender totals that belongs to a node,
    /// multiplying the normalized split at each level of its path.
    /// </summary>
    private static (double W, double T) NodeShares(string key, DateOnly d, string period)
    {
        if (key == "root") return (1, 1);
        var parts = key.Split('.');
        double w = 1, t = 1;

        var unitIdx = Array.FindIndex(Units, u => u.Code == parts[0]);
        if (unitIdx < 0) return (0, 0);
        w *= Split(1, Units.Select(u => u.Weight).ToArray(), Salt(d, period, "bu", "W"))[unitIdx];
        t *= Split(1, Units.Select(u => u.Weight).ToArray(), Salt(d, period, "bu", "T"))[unitIdx];
        if (parts.Length == 1) return (w, t);

        var divs = Units[unitIdx].Divisions;
        var divIdx = Array.FindIndex(divs, dv => dv.Code == parts[1]);
        if (divIdx < 0) return (0, 0);
        w *= Split(1, divs.Select(dv => dv.Weight).ToArray(), Salt(d, period, parts[0], "W"))[divIdx];
        t *= Split(1, divs.Select(dv => dv.Weight).ToArray(), Salt(d, period, parts[0], "T"))[divIdx];
        if (parts.Length == 2) return (w, t);

        // BusinessType: Wholesale carries only W, Tender only T.
        if (parts[2] == "W") t = 0; else if (parts[2] == "T") w = 0; else return (0, 0);
        if (parts.Length == 3) return (w, t);

        if (!int.TryParse(parts[3].TrimStart('S'), out var supplier) || supplier < 1 || supplier > SuppliersPerType)
            return (0, 0);
        var supplierWeights = Enumerable.Range(0, SuppliersPerType).Select(i => 1.0 / (1 + i * 0.5)).ToArray();
        var share = Split(1, supplierWeights, Salt(d, period, string.Join('.', parts.Take(3))))[supplier - 1];
        return (w * share, t * share);
    }

    /// <summary>Share of the selected business type's total that a drilled-into node represents.</summary>
    private static double ScopeShare(string? parent, DateOnly d, string bt, string period)
    {
        if (string.IsNullOrWhiteSpace(parent) || parent == "root") return 1;
        var (wTotal, tTotal) = RootTotals(d, bt, period);
        var (w, t) = NodeShares(parent, d, period);
        var all = wTotal + tTotal;
        return all == 0 ? 0 : (w * wTotal + t * tTotal) / all;
    }
}
