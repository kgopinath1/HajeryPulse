using System.Data;
using Dapper;
using HajeryPulse.Api.Models.Dto;

namespace HajeryPulse.Api.Data.Repositories;

public interface ISalesRepository
{
    Task<WTSummaryDto>      GetSummary(string asOfDate, string bt,string period = "week");
    Task<MarginAnalysisDto> GetMargin(string asOfDate, string bt,string period = "week");
    Task<SalesQualityDto>   GetQuality(string asOfDate, string bt, string period = "week");
    Task<OrgNodeDto>        GetOrgNode(string asOfDate, string bt, string parent, string period = "week");
    Task<IEnumerable<TopBrandDto>>    GetTopBrands(string asOfDate, string bt, string period, int limit,string parent = "root");
    Task<IEnumerable<TopCustomerDto>> GetTopCustomers(string asOfDate, string bt, string period, int limit,string parent ="root");
}

public sealed class SalesRepository : ISalesRepository
{
    private readonly IDbConnectionFactory _factory;

    public SalesRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<WTSummaryDto> GetSummary(string asOfDate, string bt, string period = "week")
    {
        using var conn = await _factory.OpenAsync();
        using var multi = await conn.QueryMultipleAsync(
            "app.sp_GetWTSummary",
            new { AsOfDate = asOfDate, Bt = bt, Period = period },
            commandType: CommandType.StoredProcedure);

        var head  = await multi.ReadFirstAsync<dynamic>();
        var spark = (await multi.ReadAsync<decimal>()).ToArray();
         var sparkLY  = (await multi.ReadAsync<decimal>()).ToArray();

        return new WTSummaryDto(
            asOfDate, bt, period,
            new RevenuePoint((decimal)head.RevenueKwd, (decimal)head.WowPct, (string)head.GrowthType),
            new WTKpis((int)head.NewOrders, (decimal)head.AvgOrderValueKwd, (decimal)head.AvgOrderValuePct,(decimal)head.PipelineAmount,
                       (int)head.ActiveTenders, (decimal)head.AvgTenderValueKwd,(decimal)head.AvgTenderValuePct),
            spark,sparkLY);
    }

    public async Task<MarginAnalysisDto> GetMargin(string asOfDate, string bt, string period = "week")
    {
        using var conn = await _factory.OpenAsync();
        using var multi = await conn.QueryMultipleAsync(
            "app.sp_GetWTMargin",
            new { AsOfDate = asOfDate, Bt = bt, Period = period },
            commandType: CommandType.StoredProcedure);

        var h = await multi.ReadFirstAsync<dynamic>();
        var trendCur = (await multi.ReadAsync<decimal>()).ToArray();
        var trendLY  = (await multi.ReadAsync<decimal>()).ToArray();

        return new MarginAnalysisDto(
            (decimal)h.MarginPct, (decimal)h.MarginPctLY, (decimal)h.MarginYoyPp,
            (decimal)h.NetSalesKwd, (decimal)h.CogsKwd, (decimal)h.GrossMarginKwd,
            (decimal)h.SalesYoyPct, (decimal)h.CogsYoyPct, (decimal)h.GrossMarginYoyPct,
            trendCur, trendLY);
    }

    public async Task<SalesQualityDto> GetQuality(string asOfDate, string bt,string period = "week")
    {
        using var conn = await _factory.OpenAsync();
        return await conn.QueryFirstOrDefaultAsync<SalesQualityDto>(
            "app.sp_GetWTSalesQuality",
            new { AsOfDate = asOfDate, Bt = bt, Period = period },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<OrgNodeDto> GetOrgNode(string asOfDate, string bt, string parent, string period = "week")
    {
        using var conn = await _factory.OpenAsync();
        using var multi = await conn.QueryMultipleAsync(
            "app.sp_GetOrgHierarchy",
            new { AsOfDate = asOfDate, Bt = bt, Parent = parent, Period = period },
            commandType: CommandType.StoredProcedure);

        var h = await multi.ReadFirstOrDefaultAsync<dynamic>();
        var children = (await multi.ReadAsync<OrgChildDto>()).ToArray();
        return new OrgNodeDto((string)h.Level, (string)h.Label, parent, children);
    }

    public async Task<IEnumerable<TopBrandDto>> GetTopBrands(string asOfDate, string bt, string period, int limit,string parent ="root")
    {
        using var conn = await _factory.OpenAsync();
        return await conn.QueryAsync<TopBrandDto>(
            "app.sp_GetTopBrands",
            new { AsOfDate = asOfDate, Bt = bt, Period = period, Limit = limit, Parent = parent },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<TopCustomerDto>> GetTopCustomers(string asOfDate, string bt, string period, int limit,string parent ="root")
    {
        using var conn = await _factory.OpenAsync();
        return await conn.QueryAsync<TopCustomerDto>(
            "app.sp_GetTopCustomers",
            new { AsOfDate = asOfDate, Bt = bt, Period = period, Limit = limit, Parent = parent },
            commandType: CommandType.StoredProcedure);
    }
}
