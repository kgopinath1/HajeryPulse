using System.Data;
using Dapper;
using HajeryPulse.Api.Models.Dto;

namespace HajeryPulse.Api.Data.Repositories;

public interface IPharmaRepository
{
    Task<IEnumerable<PharmacyDto>>          ListPharmacies();
    Task<PharmaSummaryDto>                  GetSummary(string asOfDate, string pharmacyId, string period = "week");
    Task<PharmaMarginDto>                   GetMargin(string asOfDate, string pharmacyId, string period = "week");
    Task<PharmaSalesQualityDto>             GetQuality(string asOfDate, string pharmacyId, string period = "week");
    Task<PharmaChannelDto>                  GetChannels(string asOfDate, string pharmacyId, string period = "week");
    Task<IEnumerable<PharmaPaymentDto>>     GetPayments(string asOfDate, string pharmacyId, string period = "week");
    Task<IEnumerable<PharmaCategoryDto>>    GetCategories(string asOfDate, string pharmacyId, int limit,string period = "week");
    Task<PharmaRxOtcMixDto>                 GetRxOtcMix(string asOfDate, string pharmacyId, string period = "week");
    Task<IEnumerable<PharmaDiscountDto>>    GetDiscountLeaderboard(string asOfDate, int limit,string period = "week");
    Task<IEnumerable<PharmacyDto>>          GetTopPharmacies(string asOfDate,int limit,string period = "week");
    Task<IEnumerable<PharmaTrendDto>>        GetTrend(string asOfDate, string pharmacyId, string period = "week");
}

public sealed class PharmaRepository : IPharmaRepository
{
    private readonly IDbConnectionFactory _factory;
    public PharmaRepository(IDbConnectionFactory f) => _factory = f;

    public async Task<IEnumerable<PharmacyDto>> ListPharmacies()
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryAsync<PharmacyDto>("app.sp_GetPharmacyList", commandType: CommandType.StoredProcedure);
    }

    public async Task<PharmaSummaryDto> GetSummary(string d, string id, string period = "week")
{
    using var c = await _factory.OpenAsync();

    var row = await c.QueryFirstAsync<dynamic>(
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
        return await c.QueryFirstAsync<PharmaMarginDto>("app.sp_GetPharmacyMargin",
            new { AsOfDate = d, PharmacyId = id, Period = period }, commandType: CommandType.StoredProcedure);
    }

    public async Task<PharmaSalesQualityDto> GetQuality(string d, string id, string period = "week")
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryFirstAsync<PharmaSalesQualityDto>("app.sp_GetPharmacyQuality",
            new { AsOfDate = d, PharmacyId = id, Period = period }, commandType: CommandType.StoredProcedure);
    }

    public async Task<PharmaChannelDto> GetChannels(string d, string id, string period = "week")
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryFirstAsync<PharmaChannelDto>("app.sp_GetPharmacyChannels",
            new { AsOfDate = d, PharmacyId = id, Period = period }, commandType: CommandType.StoredProcedure);
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
        return await c.QueryFirstAsync<PharmaRxOtcMixDto>("app.sp_GetPharmacyRxOtcMix",
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

    public async Task<IEnumerable<PharmaTrendDto>> GetTrend(string d, string id, string period = "week")
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryAsync<PharmaTrendDto>(
            "app.sp_GetPharmacyTrend",
            new { AsOfDate = d, PharmacyId = id, Period = period },
            commandType: CommandType.StoredProcedure);
    }
}
