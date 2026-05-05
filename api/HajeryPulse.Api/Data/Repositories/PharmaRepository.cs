using System.Data;
using Dapper;
using HajeryPulse.Api.Models.Dto;

namespace HajeryPulse.Api.Data.Repositories;

public interface IPharmaRepository
{
    Task<IEnumerable<PharmacyDto>>          ListPharmacies();
    Task<PharmaSummaryDto>                  GetSummary(string asOfDate, string pharmacyId);
    Task<PharmaMarginDto>                   GetMargin(string asOfDate, string pharmacyId);
    Task<SalesQualityDto>                   GetQuality(string asOfDate, string pharmacyId);
    Task<PharmaChannelDto>                  GetChannels(string asOfDate, string pharmacyId);
    Task<IEnumerable<PharmaPaymentDto>>     GetPayments(string asOfDate, string pharmacyId);
    Task<IEnumerable<PharmaCategoryDto>>    GetCategories(string asOfDate, string pharmacyId, int limit);
    Task<PharmaRxOtcMixDto>                 GetRxOtcMix(string asOfDate, string pharmacyId);
    Task<IEnumerable<PharmaDiscountDto>>    GetDiscountLeaderboard(string asOfDate, int limit);
    Task<IEnumerable<PharmacyDto>>          GetTopPharmacies(string asOfDate, int limit);
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

    public async Task<PharmaSummaryDto> GetSummary(string d, string id)
    {
        using var c = await _factory.OpenAsync();
        var row = await c.QueryFirstAsync<dynamic>("app.sp_GetPharmacySummary",
            new { AsOfDate = d, PharmacyId = id }, commandType: CommandType.StoredProcedure);
        return new PharmaSummaryDto(
            new PharmacyDto((string)row.Id, (string)row.Name, (decimal)row.AmtKwd),
            (decimal)row.RevenueKwd, (int)row.Transactions, (decimal)row.BasketSizeKwd,
            (int)row.StoresActive, (int)row.StoresTotal, (decimal)row.RxSharePct);
    }

    public async Task<PharmaMarginDto> GetMargin(string d, string id)
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryFirstAsync<PharmaMarginDto>("app.sp_GetPharmacyMargin",
            new { AsOfDate = d, PharmacyId = id }, commandType: CommandType.StoredProcedure);
    }

    public async Task<SalesQualityDto> GetQuality(string d, string id)
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryFirstAsync<SalesQualityDto>("app.sp_GetPharmacyQuality",
            new { AsOfDate = d, PharmacyId = id }, commandType: CommandType.StoredProcedure);
    }

    public async Task<PharmaChannelDto> GetChannels(string d, string id)
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryFirstAsync<PharmaChannelDto>("app.sp_GetPharmacyChannels",
            new { AsOfDate = d, PharmacyId = id }, commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<PharmaPaymentDto>> GetPayments(string d, string id)
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryAsync<PharmaPaymentDto>("app.sp_GetPharmacyPayments",
            new { AsOfDate = d, PharmacyId = id }, commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<PharmaCategoryDto>> GetCategories(string d, string id, int limit)
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryAsync<PharmaCategoryDto>("app.sp_GetPharmacyCategories",
            new { AsOfDate = d, PharmacyId = id, Limit = limit }, commandType: CommandType.StoredProcedure);
    }

    public async Task<PharmaRxOtcMixDto> GetRxOtcMix(string d, string id)
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryFirstAsync<PharmaRxOtcMixDto>("app.sp_GetPharmacyRxOtcMix",
            new { AsOfDate = d, PharmacyId = id }, commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<PharmaDiscountDto>> GetDiscountLeaderboard(string d, int limit)
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryAsync<PharmaDiscountDto>("app.sp_GetPharmacyDiscountLeaderboard",
            new { AsOfDate = d, Limit = limit }, commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<PharmacyDto>> GetTopPharmacies(string d, int limit)
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryAsync<PharmacyDto>("app.sp_GetTopPharmacies",
            new { AsOfDate = d, Limit = limit }, commandType: CommandType.StoredProcedure);
    }
}
