using System.Data;
using Dapper;
using HajeryPulse.Api.Models.Dto;

namespace HajeryPulse.Api.Data.Repositories;

public interface IFBRepository
{
    Task<IEnumerable<FBBrandDto>>      ListBrands();
    Task<IEnumerable<FBOutletDto>>     ListOutlets(string? brand);
    Task<FBSummaryDto>                 GetSummary(string asOfDate, string scopeType, string? scopeId);
    Task<IEnumerable<FBBrandDto>>      GetBrandSummary(string asOfDate, string scopeType, string? scopeId);
    Task<IEnumerable<FBAggregatorDto>> GetAggregators(string asOfDate, string scopeType, string? scopeId);
    Task<IEnumerable<FBPaymentDto>>    GetPayments(string asOfDate, string scopeType, string? scopeId);
    Task<IEnumerable<FBBrandDto>>      GetDeliveryByBrand(string asOfDate, string scopeType, string? scopeId);
    Task<IEnumerable<FBOutletDto>>     GetTopOutlets(string asOfDate, string scopeType, string? scopeId, int limit);
}

public sealed class FBRepository : IFBRepository
{
    private readonly IDbConnectionFactory _factory;
    public FBRepository(IDbConnectionFactory f) => _factory = f;

    public async Task<IEnumerable<FBBrandDto>> ListBrands()
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryAsync<FBBrandDto>("app.sp_GetFBBrands", commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<FBOutletDto>> ListOutlets(string? brand)
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryAsync<FBOutletDto>("app.sp_GetFBOutlets",
            new { Brand = brand }, commandType: CommandType.StoredProcedure);
    }

    public async Task<FBSummaryDto> GetSummary(string d, string st, string? sid)
    {
        using var c = await _factory.OpenAsync();
        var row = await c.QueryFirstAsync<dynamic>("app.sp_GetFBSummary",
            new { AsOfDate = d, ScopeType = st, ScopeId = sid }, commandType: CommandType.StoredProcedure);
        return new FBSummaryDto(
            new FBScopeDto((string)row.ScopeType, (string?)row.ScopeId, (string)row.ScopeName),
            (decimal)row.RevenueKwd, (int)row.Covers, (decimal)row.TicketKwd,
            (int)row.OutletsActive, (int)row.OutletsTotal, (decimal)row.YoyPct);
    }

    public async Task<IEnumerable<FBBrandDto>> GetBrandSummary(string d, string st, string? sid)
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryAsync<FBBrandDto>("app.sp_GetFBBrandSummary",
            new { AsOfDate = d, ScopeType = st, ScopeId = sid }, commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<FBAggregatorDto>> GetAggregators(string d, string st, string? sid)
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryAsync<FBAggregatorDto>("app.sp_GetFBAggregators",
            new { AsOfDate = d, ScopeType = st, ScopeId = sid }, commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<FBPaymentDto>> GetPayments(string d, string st, string? sid)
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryAsync<FBPaymentDto>("app.sp_GetFBPayments",
            new { AsOfDate = d, ScopeType = st, ScopeId = sid }, commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<FBBrandDto>> GetDeliveryByBrand(string d, string st, string? sid)
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryAsync<FBBrandDto>("app.sp_GetFBDeliveryByBrand",
            new { AsOfDate = d, ScopeType = st, ScopeId = sid }, commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<FBOutletDto>> GetTopOutlets(string d, string st, string? sid, int limit)
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryAsync<FBOutletDto>("app.sp_GetFBTopOutlets",
            new { AsOfDate = d, ScopeType = st, ScopeId = sid, Limit = limit },
            commandType: CommandType.StoredProcedure);
    }
}
