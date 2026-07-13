using System.Data;
using System.Linq;
using Dapper;
using HajeryPulse.Api.Models.Dto;

namespace HajeryPulse.Api.Data.Repositories;

public interface IPharmaRepository
{
    Task<IEnumerable<PharmacyDto>>          ListPharmacies(string asOfDate,  string period = "week");
    Task<PharmaSummaryDto>                  GetSummary(string asOfDate, string pharmacyId, string period = "week");
    Task<PharmaMarginDto>                   GetMargin(string asOfDate, string pharmacyId, string period = "week");
    Task<PharmaSalesQualityDto>             GetQuality(string asOfDate, string pharmacyId, string period = "week");
    Task<List<PharmaChannelDto>>            GetChannels(string asOfDate, string pharmacyId, string period = "week");
    Task<IEnumerable<PharmaPaymentDto>>     GetPayments(string asOfDate, string pharmacyId, string period = "week");
    Task<IEnumerable<PharmaCategoryDto>>    GetCategories(string asOfDate, string pharmacyId, int limit,string period = "week");
    Task<PharmaRxOtcMixDto>                 GetRxOtcMix(string asOfDate, string pharmacyId, string period = "week");
    Task<IEnumerable<PharmaDiscountDto>>    GetDiscountLeaderboard(string asOfDate, int limit,string period = "week");
    Task<IEnumerable<PharmacyDto>>          GetTopPharmacies(string asOfDate,int limit,string period = "week");
    Task<PharmaTrendDto>        GetTrend(string asOfDate, string pharmacyId, string period = "week");
}

public sealed class PharmaRepository : IPharmaRepository
{
    private readonly IDbConnectionFactory _factory;
    public PharmaRepository(IDbConnectionFactory f) => _factory = f;

    public async Task<IEnumerable<PharmacyDto>> ListPharmacies(string d, string period = "week")
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryAsync<PharmacyDto>("app.sp_GetPharmacyList",
        new { AsOfDate = d, Period = period },
        commandType: CommandType.StoredProcedure);
    }

    public async Task<PharmaSummaryDto> GetSummary(string d, string id, string period = "week")
{
    using var c = await _factory.OpenAsync();

    var row = await c.QueryFirstOrDefaultAsync<dynamic>(
        "app.sp_GetPharmacySummary",
        new { AsOfDate = d, PharmacyId = id, Period = period },
        commandType: CommandType.StoredProcedure
    );

    decimal revenue = (decimal?)(row.RevenueKwd) ?? 0m;
    int txns = (int?)(row.Txns) ?? 0;
     decimal deltaTxns = (decimal?)(row.DeltaTxns) ?? 0m;
     decimal prevbasketSize = (decimal?)(row.PrevBasketSizeKwd) ?? 0m;
 decimal basketDelta = (decimal?)(row.DeltaBasketSizeKwd) ?? 0m;
    decimal basket = (decimal?)(row.BasketSizeKwd) ?? 0m;
   

    decimal growthPct = (decimal?)(row.GrowthPct) ?? 0m;
    string growthType = (string)(row.GrowthType) ?? "WoW";
    decimal yoyPct = (decimal?)(row.YoyPct) ?? 0m;

    return new PharmaSummaryDto(
        new PharmacyDto(
            (string)row.Id,
            (string)row.Name,
            revenue   // ✅ fixed (was AmtKwd before)
        ),
        revenue,
        txns,
        deltaTxns,
        prevbasketSize,
        basketDelta,
        basket,
        (int?)(row.StoresActive) ?? 0,
        (int?)(row.StoresTotal) ?? 0,

        // ✅ New fields
        growthPct,
        growthType,
        yoyPct
    );
}

public async Task<PharmaMarginDto> GetMargin(string d, string id, string period = "week")
{
    using var c = await _factory.OpenAsync();
    using var multi = await c.QueryMultipleAsync("app.sp_GetPharmacyMargin",
        new { AsOfDate = d, PharmacyId = id, Period = period }, commandType: CommandType.StoredProcedure);

    var s = await multi.ReadFirstAsync<dynamic>();
    var trend = (await multi.ReadAsync<decimal>()).ToArray();
    var trendLY = (await multi.ReadAsync<decimal>()).ToArray();

    return new PharmaMarginDto(
        (decimal)s.GrossKwd, (decimal)s.DiscountKwd, (decimal)s.CogsKwd,
        (decimal)s.MarginKwd, (decimal)s.NetSalesKwd,
        (decimal)s.MarginPct, (decimal)s.MarginPctLY, (decimal)s.MarginDeviationPp,
        (decimal)s.LyGrossKwd, (decimal)s.LyNetSalesKwd, (decimal)s.LyCogsKwd,
        (decimal)s.GrossYoyPct, (decimal)s.CogsYoyPct, (decimal)s.GrossMarginYoyPct, (decimal)s.DiscountPct,
        (string)s.GrowthType,
        trend, trendLY);
}

public async Task<PharmaSalesQualityDto> GetQuality(string d, string id, string period = "week")
{
    using var c = await _factory.OpenAsync();
    return await c.QueryFirstOrDefaultAsync<PharmaSalesQualityDto>("app.sp_GetPharmacyQuality",
        new { AsOfDate = d, PharmacyId = id, Period = period }, commandType: CommandType.StoredProcedure);
}

public async Task<List<PharmaChannelDto>> GetChannels(
    string d,
    string id,
    string period = "week")
{
    using var c = await _factory.OpenAsync();

    var result = await c.QueryAsync<PharmaChannelDto>(
        "app.sp_GetPharmacyChannels",
        new
        {
            AsOfDate = d,
            PharmacyId = id,
            Period = period
        },
        commandType: CommandType.StoredProcedure);

    return result.ToList();
}
    public async Task<IEnumerable<PharmaPaymentDto>> GetPayments(string d, string id, string period = "week")
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryAsync<PharmaPaymentDto>("app.sp_GetPharmacyPayments",
            new { AsOfDate = d, PharmacyId = id, Period = period }, commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<PharmaCategoryDto>> GetCategories(string d, string id, int limit,string period = "week")
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryAsync<PharmaCategoryDto>("app.sp_GetPharmacyCategories",
            new { AsOfDate = d, PharmacyId = id, Limit = limit ,Period=period}, commandType: CommandType.StoredProcedure);
    }

    public async Task<PharmaRxOtcMixDto> GetRxOtcMix(string d, string id, string period = "week")
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryFirstOrDefaultAsync<PharmaRxOtcMixDto>("app.sp_GetPharmacyRxOtcMix",
            new { AsOfDate = d, PharmacyId = id, Period = period }, commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<PharmaDiscountDto>> GetDiscountLeaderboard(string d, int limit,string period="week")
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryAsync<PharmaDiscountDto>("app.sp_GetPharmacyDiscountLeaderboard",
            new { AsOfDate = d, Limit = limit,Period=period }, commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<PharmacyDto>> GetTopPharmacies(string d,int limit,string period = "week")
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryAsync<PharmacyDto>("app.sp_GetTopPharmacies",
            new { AsOfDate = d, Limit = limit ,Period=period}, commandType: CommandType.StoredProcedure);
    }

    public async Task<PharmaTrendDto> GetTrend(string d, string id, string period = "week")
    {
        using var c = await _factory.OpenAsync();
        var rows = (await c.QueryAsync<dynamic>(
            "app.sp_GetPharmacyTrend",
            new { AsOfDate = d, PharmacyId = id, Period = period },
            commandType: CommandType.StoredProcedure)).ToList();

        var orderedRows = rows
            .OrderBy(row => (int)row.Slot)
            .ToList();

        var current = orderedRows
            .Select(row => (decimal?)(row.CurrentValue) ?? 0m)
            .ToArray();

        var previous = orderedRows
            .Select(row => (decimal?)(row.PreviousValue) ?? 0m)
            .ToArray();

        return new PharmaTrendDto(current, previous);
    }
}
