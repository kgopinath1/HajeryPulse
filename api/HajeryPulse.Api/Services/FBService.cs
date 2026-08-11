using System.Runtime.CompilerServices;
using HajeryPulse.Api.Data.Repositories;
using HajeryPulse.Api.Models.Dto;

namespace HajeryPulse.Api.Services;

public interface IFBService
{
    Task<IEnumerable<FBBrandDto>>      ListBrands(string asOfDate,string period = "week");
    Task<IEnumerable<FBOutletDto>> ListOutlets(
     string asOfDate,
     string scopeType = "all",
     string? scopeId = null,
     string period = "week");

    Task<FBSummaryDto>                 GetSummary(string asOfDate, string scopeType, string? scopeId,string period);
    Task<IEnumerable<FBBrandDto>>      GetBrandSummary(string asOfDate, string scopeType, string? scopeId, string period);
    Task<IEnumerable<FBAggregatorDto>> GetAggregators(string asOfDate, string scopeType, string? scopeId,string period);
    Task<IEnumerable<FBPaymentDto>>    GetPayments(string asOfDate, string scopeType, string? scopeId,string period);
    Task<List<FBChannelMixDto> >             GetChannels(string asOfDate, string scopeType, string? scopeId,string period);
    Task<IEnumerable<FBBrandDto>>      GetDeliveryByBrand(string asOfDate, string scopeType, string? scopeId,string period);
    Task<IEnumerable<FBOutletDto>>     GetTopOutlets(string asOfDate, string scopeType, string? scopeId, string Period, int limit);
    Task<FBTrendDto> GetTrend(string asOfDate, string scopeType, string? scopeId, string period);


}

public sealed class FBService : IFBService
{
    private readonly IFBRepository _repo;

    public FBService(IFBRepository repo)
    {
        _repo = repo;
    }

    public async Task<IEnumerable<FBBrandDto>> ListBrands(string d,  string per)
       => (await _repo.ListBrands(d, per)) ?? Enumerable.Empty<FBBrandDto>();

    public async Task<IEnumerable<FBOutletDto>> ListOutlets(string d, string st, string? sid, string per)
        => (await _repo.ListOutlets(d, st, sid, per)) ?? Enumerable.Empty<FBOutletDto>();

    public Task<FBSummaryDto> GetSummary(string d, string st, string? sid, string per)
      => _repo.GetSummary(d, st, sid, per);

    public async Task<IEnumerable<FBBrandDto>> GetBrandSummary(string d, string st, string? sid, string per)
            => (await _repo.GetBrandSummary(d, st, sid, per)) ?? Enumerable.Empty<FBBrandDto>();

    public async Task<IEnumerable<FBAggregatorDto>> GetAggregators(string d, string st, string? sid,string per)
                => (await _repo.GetAggregators(d, st, sid,per)) ?? Enumerable.Empty<FBAggregatorDto>();

    public async Task<IEnumerable<FBPaymentDto>> GetPayments(string d, string st, string? sid, string per)
                => (await _repo.GetPayments(d, st, sid, per)) ?? Enumerable.Empty<FBPaymentDto>();

public Task<List<FBChannelMixDto>> GetChannels(
    string d,
    string st,
    string? sid,
    string per)
    => _repo.GetChannels(d, st, sid, per);

    public async Task<IEnumerable<FBBrandDto>> GetDeliveryByBrand(string d, string st, string? sid,string per)
                => (await _repo.GetDeliveryByBrand(d, st, sid, per)) ?? Enumerable.Empty<FBBrandDto>();

    public async Task<IEnumerable<FBOutletDto>> GetTopOutlets(string d, string st, string? sid,string per, int limit)
                => (await _repo.GetTopOutlets(d, st, sid, per,limit)) ?? Enumerable.Empty<FBOutletDto>();

    public async Task<FBTrendDto> GetTrend(
    string d,
    string st,
    string? sid,
    string per)
{
    return await _repo.GetTrend(d, st, sid, per);
}
}
