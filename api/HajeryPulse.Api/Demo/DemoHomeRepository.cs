using HajeryPulse.Api.Data.Repositories;
using HajeryPulse.Api.Models.Dto;
using static HajeryPulse.Api.Demo.DemoData;

namespace HajeryPulse.Api.Demo;

/// <summary>
/// Home screen sample data. Built from the same business-line curves as the
/// other demo repositories, so the group total equals Wholesale &amp; Tender +
/// F&amp;B + Pharmacies for the same date and period.
/// </summary>
public sealed class DemoHomeRepository : IHomeRepository
{
    public Task<HomeDto> GetCombinedRevenue(string asOfDate, string period)
    {
        var d = ParseDate(asOfDate);
        var all = Revenue(new[] { Wholesale, Tender, FB, Pharma }, d, period);
        var fb = Revenue(new[] { FB }, d, period);
        var pharma = Revenue(new[] { Pharma }, d, period);

        return Task.FromResult(new HomeDto(
            TotalRevenueKwd: Kwd(all.Current),
            GrowthPct: Pct(all.GrowthPct),
            GrowthType: GrowthType(period),
            FbRevenueKwd: Kwd(fb.Current),
            PharmaRevenueKwd: Kwd(pharma.Current)));
    }

    public Task<HomeQuickKpisDto> GetQuickKpis(string asOfDate)
    {
        // Quick KPIs are month to date vs the same days last month (MoM).
        var d = ParseDate(asOfDate);
        const string period = "month";
        var wt = Revenue(new[] { Wholesale, Tender }, d, period);
        var fb = Revenue(new[] { FB }, d, period);
        var ph = Revenue(new[] { Pharma }, d, period);

        double Orders(Stats s, double avg, bool previous) => (previous ? s.Previous : s.Current) / avg;
        var orders = Orders(wt, 1_850, false) + Orders(fb, 7.4, false) + Orders(ph, 9.6, false);
        var ordersPrev = Orders(wt, 1_850, true) + Orders(fb, 7.4, true) + Orders(ph, 9.6, true);
        var revenue = wt.Current + fb.Current + ph.Current;
        var revenuePrev = wt.Previous + fb.Previous + ph.Previous;
        var aov = revenue / orders;
        var aovPrev = revenuePrev / ordersPrev;
        var key = Salt(d, period, "home");

        return Task.FromResult(new HomeQuickKpisDto(
            TotalOrders: (int)Math.Round(orders),
            OrdersDeltaPct: Pct(Change(orders, ordersPrev)),
            AvgOrderValueKwd: Kwd(aov),
            AvgOrderValueDeltaPct: Pct(Change(aov, aovPrev)),
            GrossMarginPct: Pct(26.4 * Noise(key + "|gm", 0.03)),
            GrossMarginDeltaPp: Pct(Offset(key + "|gmd", 1.2)),
            FulfillmentPct: Pct(96.8 * Noise(key + "|ful", 0.012)),
            FulfillmentDeltaPp: Pct(Offset(key + "|fuld", 1.0)),
            GrowthType: "MoM"));
    }
}
