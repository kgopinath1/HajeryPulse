using Dapper;
using HajeryPulse.Api.Models.Dto;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using Serilog.Core;
using System.Data;

namespace HajeryPulse.Api.Data.Repositories;


public interface IFBRepository
{
    Task<IEnumerable<FBBrandDto>>      ListBrands();
    Task<IEnumerable<FBOutletDto>> ListOutlets(
    string asOfDate,
    string scopeType = "all",
    string? scopeId = null,
    string period = "week");

    Task<FBSummaryDto>                 GetSummary(string asOfDate, string scopeType, string? scopeId,string period);
    Task<IEnumerable<FBBrandDto>>      GetBrandSummary(string asOfDate, string scopeType, string? scopeId,string period);
    Task<IEnumerable<FBAggregatorDto>> GetAggregators(string asOfDate, string scopeType, string? scopeId,string period);
    Task<IEnumerable<FBPaymentDto>>    GetPayments(string asOfDate, string scopeType, string? scopeId,string period);
    Task<FBChannelMixDto>              GetChannels(string asOfDate, string scopeType, string? scopeId,string period);
    Task<IEnumerable<FBBrandDto>>      GetDeliveryByBrand(string asOfDate, string scopeType, string? scopeId,string period);
    Task<IEnumerable<FBOutletDto>>     GetTopOutlets(string asOfDate, string scopeType, string? scopeId, string period,int limit);
    Task<IEnumerable<FBTrendDto>> GetTrend(string d, string st, string? sid, string per);

}



public sealed class FBRepository : IFBRepository
{
    private readonly IDbConnectionFactory _factory;
   // private readonly ILogger<FBRepository> _logger;
   // private ILogger<FBRepository>? logger;

    public FBRepository(IDbConnectionFactory f)

    {
        _factory = f;
       // logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }


    //public async Task<IEnumerable<FBBrandDto>> ListBrands()
    //{
    //    using var c = await _factory.OpenAsync();
    //    return await c.QueryAsync<FBBrandDto>("app.sp_GetFBBrands", commandType: CommandType.StoredProcedure);
    //}

    public async Task<IEnumerable<FBBrandDto>> ListBrands()
    {
        using var c = await _factory.OpenAsync();
        var rows = await c.QueryAsync<dynamic>("app.sp_GetFBBrands", commandType: CommandType.StoredProcedure);
        return rows.Select(row => new FBBrandDto(
            Id: (string?)row.Id ?? "",
            Name: (string?)row.Name ?? "",
            AmtKwd: (decimal?)row.AmtKwd ?? 0m,
            Color: (string?)row.Color ?? "#bdc3c7",
            OutletCount: (int?)row.OutletCount ?? 0,
            GrowthPct: 0m,
            GrowthType: "WoW",
            YoyPct: 0m,
            DeliveryKwd: 0m
        ));
    }


    public async Task<IEnumerable<FBOutletDto>> ListOutlets(string d, string st, string? sid, string per = "week")
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryAsync<FBOutletDto>(
            "app.sp_GetFBOutlets",
            new
            {
              
                AsOfDate = d,  // DateOnly → DateTime for Dapper
                ScopeType = st,
                ScopeId = sid,
                Period = per
            },
            commandType: CommandType.StoredProcedure);
       
    }



    public async Task<FBSummaryDto> GetSummary(string d, string st, string? sid, string per)
    {
        using var c = await _factory.OpenAsync();
        var row = await c.QueryFirstAsync<dynamic>("app.sp_GetFBSummary",
            new { AsOfDate = d, ScopeType = st, ScopeId = sid, period = per }, commandType: CommandType.StoredProcedure);
        if (row == null)
            return new FBSummaryDto(
                new FBScopeDto(st, sid, sid ?? "All"),
                0m, 0,0m, 0m,0m, 0, 0, 0m, "WoW", 0m);
        return new FBSummaryDto(
        new FBScopeDto((string)row.ScopeType, (string?)row.ScopeId, (string?)row.ScopeName ?? sid ?? "All"),
        (decimal?)row.RevenueKwd ?? 0m,
        (int?)row.Covers ?? 0,
        (decimal?)row.CoversDelta ?? 0m,
        (decimal?)row.TicketKwd ?? 0m,
        (decimal?)row.TicketKwdDelta ?? 0m,
        (int?)row.OutletsActive ?? 0,
        (int?)row.OutletsTotal ?? 0,
        (decimal?)row.GrowthPct ?? 0m,
        (string?)row.GrowthType ?? "WoW",
        (decimal?)row.YoyPct ?? 0m
        );
    }


    //public async Task<IEnumerable<FBBrandDto>> GetBrandSummary(
    //string d, string st, string? sid, string per)
    //{
    //    using var c = await _factory.OpenAsync();

    //    var rows = await c.QueryAsync<FBBrandDto>(
    //        "app.sp_GetFBBrandSummary",
    //        new { AsOfDate = d, ScopeType = st, ScopeId = sid, Period = per },
    //        commandType: CommandType.StoredProcedure);

    //    return rows;
    //}

    public async Task<IEnumerable<FBBrandDto>> GetBrandSummary(
    string d, string st, string? sid, string per)
    {
        using var c = await _factory.OpenAsync();
        var rows = await c.QueryAsync<dynamic>(
            "app.sp_GetFBBrandSummary",
            new { AsOfDate = d, ScopeType = st, ScopeId = sid, Period = per },
            commandType: CommandType.StoredProcedure);

        return rows.Select(row => new FBBrandDto(
            Id: (string?)row.Id ?? "",
            Name: (string?)row.Name ?? "",
            AmtKwd: (decimal?)row.AmtKwd ?? 0m,
            Color: (string?)row.Color ?? "#bdc3c7",
            OutletCount: (int?)row.OutletCount ?? 0,
            GrowthPct: (decimal?)row.GrowthPct ?? 0m,
            GrowthType: (string?)row.GrowthType ?? "WoW",
            YoyPct: (decimal?)row.YoyPct ?? 0m,
            DeliveryKwd: (decimal?)row.DeliveryKwd ?? 0m
        ));
    }



    public async Task<IEnumerable<FBAggregatorDto>> GetAggregators(string d, string st, string? sid,string per)
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryAsync<FBAggregatorDto>("app.sp_GetFBAggregators",
            new { AsOfDate = d, ScopeType = st, ScopeId = sid, Period = per }, commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<FBPaymentDto>> GetPayments(string d, string st, string? sid,string per)
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryAsync<FBPaymentDto>("app.sp_GetFBPayments",
            new { AsOfDate = d, ScopeType = st, ScopeId = sid ,Period=per}, commandType: CommandType.StoredProcedure);
    }

    public async Task<FBChannelMixDto> GetChannels(string d, string st, string? sid,string per)
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryFirstAsync<FBChannelMixDto>("app.sp_GetFBChannelMix",
            new { AsOfDate = d, ScopeType = st, ScopeId = sid, Period = per }, commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<FBBrandDto>> GetDeliveryByBrand(string d, string st, string? sid,string per)
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryAsync<FBBrandDto>("app.sp_GetFBDeliveryByBrand",
            new { AsOfDate = d, ScopeType = st, ScopeId = sid, Period = per }, commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<FBOutletDto>> GetTopOutlets(
       string d, string st, string? sid, string per,int limit )
    {
        using var c = await _factory.OpenAsync();

        var rows = await c.QueryAsync<dynamic>(
            "app.sp_GetFBTopOutlets",
            new { AsOfDate = d, ScopeType = st, ScopeId = sid, Period = per,Limit = limit },
            commandType: CommandType.StoredProcedure);

        return rows.Select(row => new FBOutletDto(
            Code: (string?)row.Code ?? "",
            Name: (string?)row.Name ?? "",
            BrandId: (string?)row.BrandId ?? "",
            AmtKwd: (decimal?)row.AmtKwd ?? 0m,
            GrowthPct: (decimal?)row.GrowthPct ?? 0m,
            GrowthType: (string?)row.GrowthType ?? "WoW",
            YoyPct: (decimal?)row.YoyPct ?? 0m
        ));
    }

    public async Task<IEnumerable<FBTrendDto>> GetTrend(string d, string st, string? sid, string per)
    {
        using var c = await _factory.OpenAsync();

        return await c.QueryAsync<FBTrendDto>(
            "app.sp_GetFBTrend",
            new { AsOfDate = d, ScopeType = st, ScopeId = sid, period = per },
            commandType: CommandType.StoredProcedure
        );


    
}
//    private static FBBrandDto MapBrandDto(dynamic row) => new FBBrandDto(
//    Id: (string?)row.Id ?? "",
//    Name: (string?)row.Name ?? "",
//    AmtKwd: (decimal?)row.AmtKwd ?? 0m,
//    Color: (string?)row.Color ?? "#bdc3c7",
//    OutletCount: (int?)row.OutletCount ?? 0,
//    GrowthPct: (decimal?)row.GrowthPct ?? 0m,
//    GrowthType: (string?)row.GrowthType ?? "WoW",
//    YoyPct: (decimal?)row.YoyPct ?? 0m,
//    DeliveryKwd: (decimal?)row.DeliveryKwd ?? 0m
//); 
}
