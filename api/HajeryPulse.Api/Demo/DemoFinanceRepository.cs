using HajeryPulse.Api.Data.Repositories;
using HajeryPulse.Api.Models.Dto;
using static HajeryPulse.Api.Demo.DemoData;

namespace HajeryPulse.Api.Demo;

/// <summary>Finance &amp; Ops sample data for the demo account.</summary>
public sealed class DemoFinanceRepository : IFinanceRepository
{
    public Task<FinanceHealthDto> GetHealth(string asOfDate)
    {
        var d = ParseDate(asOfDate);
        var key = $"fin|{d:yyyyMMdd}";
        return Task.FromResult(new FinanceHealthDto(
            GrossMarginPct: Pct(24.6 * Noise(key + "|gm", 0.03)),
            TargetPct: 26.0m,
            PreviousPct: Pct(24.1 * Noise(key + "|gmp", 0.03)),
            ArDaysOutstanding: 58 + (int)(Unit(key + "|ar") * 12),
            ApDaysOutstanding: 47 + (int)(Unit(key + "|ap") * 10),
            WorkingCapitalKwd: Kwd(12_400_000 * Noise(key + "|wc", 0.05)),
            CashOnHandKwd: Kwd(3_800_000 * Noise(key + "|cash", 0.08))));
    }

    public Task<OpsSummaryDto> GetOps(string asOfDate)
    {
        var d = ParseDate(asOfDate);
        var key = $"ops|{d:yyyyMMdd}";
        return Task.FromResult(new OpsSummaryDto(
            FillRatePct: Pct(96.2 * Noise(key + "|fill", 0.015)),
            SlaCompliancePct: Pct(93.5 * Noise(key + "|sla", 0.02)),
            AvgDispatchHours: Pct(18.4 * Noise(key + "|disp", 0.12)),
            OpenServiceTickets: 15 + (int)(Unit(key + "|tix") * 18)));
    }
}
