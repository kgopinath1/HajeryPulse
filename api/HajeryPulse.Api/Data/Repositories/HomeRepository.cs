using Dapper;
using HajeryPulse.Api.Models.Dto;
using System.Data;

namespace HajeryPulse.Api.Data.Repositories;

public interface IHomeRepository
{
    Task<HomeDto> GetCombinedRevenue(string asOfDate, string period);
    Task<HomeQuickKpisDto> GetQuickKpis(string asOfDate);
}

public sealed class HomeRepository : IHomeRepository
{
    private readonly IDbConnectionFactory _factory;

    public HomeRepository(IDbConnectionFactory f)
    {
        _factory = f;
    }

    public async Task<HomeDto> GetCombinedRevenue(string d, string per)
    {
        using var c = await _factory.OpenAsync();
        var row = await c.QueryFirstOrDefaultAsync<dynamic>(
            "app.sp_GetHomeCombinedRevenue",
            new { AsOfDate = d, Period = per },
            commandType: CommandType.StoredProcedure);

        if (row == null)
            return new HomeDto(0m, 0m, "WoW", 0m, 0m);

        return new HomeDto(
            TotalRevenueKwd:   (decimal?)row.TotalRevenueKwd   ?? 0m,
            GrowthPct:         (decimal?)row.GrowthPct         ?? 0m,
            GrowthType:        (string?)row.GrowthType         ?? "WoW",
            FbRevenueKwd:      (decimal?)row.FbRevenueKwd      ?? 0m,
            PharmaRevenueKwd:  (decimal?)row.PharmaRevenueKwd  ?? 0m
        );
    }

   public async Task<HomeQuickKpisDto> GetQuickKpis(string d)
{
    using var c = await _factory.OpenAsync();
    var row = await c.QueryFirstOrDefaultAsync<dynamic>(
        "app.sp_GetHomeQuickKpis",
        new { AsOfDate = d },
        commandType: CommandType.StoredProcedure);

    if (row == null)
        return new HomeQuickKpisDto(0, 0m, 0m, 0m, 0m, 0m, 0m, 0m, "MoM");

    return new HomeQuickKpisDto(
        TotalOrders:            (int?)row.TotalOrders ?? 0,
        OrdersDeltaPct:         (decimal?)row.OrdersDeltaPct ?? 0m,
        AvgOrderValueKwd:       (decimal?)row.AvgOrderValueKwd ?? 0m,
        AvgOrderValueDeltaPct:  (decimal?)row.AvgOrderValueDeltaPct ?? 0m,
        GrossMarginPct:         (decimal?)row.GrossMarginPct ?? 0m,
        GrossMarginDeltaPp:     (decimal?)row.GrossMarginDeltaPp ?? 0m,
        FulfillmentPct:         (decimal?)row.FulfillmentPct ?? 0m,
        FulfillmentDeltaPp:     (decimal?)row.FulfillmentDeltaPp ?? 0m,
        GrowthType:             (string?)row.GrowthType ?? "MoM"
    );
}

}