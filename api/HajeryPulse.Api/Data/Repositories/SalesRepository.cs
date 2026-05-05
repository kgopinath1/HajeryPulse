using System.Data;
using Dapper;
using HajeryPulse.Api.Models.Dto;

namespace HajeryPulse.Api.Data.Repositories;

public interface ISalesRepository
{
    Task<WTSummaryDto>      GetSummary(string asOfDate, string bt);
    Task<MarginAnalysisDto> GetMargin(string asOfDate, string bt);
    Task<SalesQualityDto>   GetQuality(string asOfDate, string bt);
    Task<OrgNodeDto>        GetOrgNode(string asOfDate, string bt, string parent);
    Task<IEnumerable<TopBrandDto>>    GetTopBrands(string asOfDate, string bt, int limit);
    Task<IEnumerable<TopCustomerDto>> GetTopCustomers(string asOfDate, string bt, int limit);
}

public sealed class SalesRepository : ISalesRepository
{
    private readonly IDbConnectionFactory _factory;

    public SalesRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<WTSummaryDto> GetSummary(string asOfDate, string bt)
    {
        using var conn = await _factory.OpenAsync();
        using var multi = await conn.QueryMultipleAsync(
            "app.sp_GetWTSummary",
            new { AsOfDate = asOfDate, Bt = bt },
            commandType: CommandType.StoredProcedure);

        var head  = await multi.ReadFirstAsync<dynamic>();
        var spark = (await multi.ReadAsync<decimal>()).ToArray();

        return new WTSummaryDto(
            asOfDate, bt,
            new RevenuePoint((decimal)head.RevenueKwd, (decimal)head.WowPct),
            new WTKpis((int)head.NewOrders, (decimal)head.OpenOrderValueKwd,
                       (int)head.ActiveTenders, (decimal)head.AvgTenderValueKwd),
            spark);
    }

    public async Task<MarginAnalysisDto> GetMargin(string asOfDate, string bt)
    {
        using var conn = await _factory.OpenAsync();
        using var multi = await conn.QueryMultipleAsync(
            "app.sp_GetWTMargin",
            new { AsOfDate = asOfDate, Bt = bt },
            commandType: CommandType.StoredProcedure);

        var h = await multi.ReadFirstAsync<dynamic>();
        var trendCur = (await multi.ReadAsync<decimal>()).ToArray();
        var trendLY  = (await multi.ReadAsync<decimal>()).ToArray();

        return new MarginAnalysisDto(
            (decimal)h.MarginPct, (decimal)h.MarginPctLY, (decimal)h.MarginYoyPp,
            (decimal)h.NetSalesKwd, (decimal)h.CogsKwd, (decimal)h.GrossMarginKwd,
            trendCur, trendLY);
    }

    public async Task<SalesQualityDto> GetQuality(string asOfDate, string bt)
    {
        using var conn = await _factory.OpenAsync();
        return await conn.QueryFirstAsync<SalesQualityDto>(
            "app.sp_GetWTSalesQuality",
            new { AsOfDate = asOfDate, Bt = bt },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<OrgNodeDto> GetOrgNode(string asOfDate, string bt, string parent)
    {
        using var conn = await _factory.OpenAsync();
        using var multi = await conn.QueryMultipleAsync(
            "app.sp_GetOrgHierarchy",
            new { AsOfDate = asOfDate, Bt = bt, Parent = parent },
            commandType: CommandType.StoredProcedure);

        var h = await multi.ReadFirstAsync<dynamic>();
        var children = (await multi.ReadAsync<OrgChildDto>()).ToArray();
        return new OrgNodeDto((string)h.Level, (string)h.Label, parent, children);
    }

    public async Task<IEnumerable<TopBrandDto>> GetTopBrands(string asOfDate, string bt, int limit)
    {
        using var conn = await _factory.OpenAsync();
        return await conn.QueryAsync<TopBrandDto>(
            "app.sp_GetTopBrands",
            new { AsOfDate = asOfDate, Bt = bt, Limit = limit },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<TopCustomerDto>> GetTopCustomers(string asOfDate, string bt, int limit)
    {
        using var conn = await _factory.OpenAsync();
        return await conn.QueryAsync<TopCustomerDto>(
            "app.sp_GetTopCustomers",
            new { AsOfDate = asOfDate, Bt = bt, Limit = limit },
            commandType: CommandType.StoredProcedure);
    }
}
