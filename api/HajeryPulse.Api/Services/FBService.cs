using System.Runtime.CompilerServices;
using HajeryPulse.Api.Data.Repositories;
using HajeryPulse.Api.Models.Dto;

namespace HajeryPulse.Api.Services;

public interface IFBService
{
    Task<IEnumerable<FBBrandDto>>      ListBrands();
    Task<IEnumerable<FBOutletDto>> ListOutlets(
     string asOfDate,
     string scopeType = "all",
     string? scopeId = null,
     string period = "week");

    Task<FBSummaryDto>                 GetSummary(string asOfDate, string scopeType, string? scopeId,string period);
    Task<IEnumerable<FBBrandDto>>      GetBrandSummary(string asOfDate, string scopeType, string? scopeId, string period);
    Task<IEnumerable<FBAggregatorDto>> GetAggregators(string asOfDate, string scopeType, string? scopeId,string period);
    Task<IEnumerable<FBPaymentDto>>    GetPayments(string asOfDate, string scopeType, string? scopeId,string period);
    Task<FBChannelMixDto>              GetChannels(string asOfDate, string scopeType, string? scopeId,string period);
    Task<IEnumerable<FBBrandDto>>      GetDeliveryByBrand(string asOfDate, string scopeType, string? scopeId,string period);
    Task<IEnumerable<FBOutletDto>>     GetTopOutlets(string asOfDate, string scopeType, string? scopeId, string Period, int limit);
    Task<IEnumerable<FBTrendDto>> GetTrend(string asOfDate, string scopeType, string? scopeId, string period);


}

public sealed class FBService : IFBService
{
    private readonly IFBRepository _repo;
    // private readonly ICacheService _cache;
    private readonly TimeSpan _ttl;

    //public FBService(IFBRepository repo, ICacheService cache, IConfiguration config)
    //{
    //    _repo = repo;
    //    _cache = cache;
    //    _ttl = TimeSpan.FromSeconds(config.GetValue<int>("Cache:DashboardTtlSeconds", 600));
    //}
    public FBService(IFBRepository repo, IConfiguration config)
    {
        _repo = repo;
        // _cache = cache;
        // _ttl = TimeSpan.FromSeconds(config.GetValue<int>("Cache:DashboardTtlSeconds", 600));
    }

    private static string K(string s, params object?[] p) => $"hp:fb:{s}:" + string.Join(":", p);

    public async Task<IEnumerable<FBBrandDto>> ListBrands()
       //  => (await _cache.GetOrSetAsync(K("brands"), _ttl, async () => (await _repo.ListBrands()).ToList())) ?? Enumerable.Empty<FBBrandDto>();
       => (await _repo.ListBrands()) ?? Enumerable.Empty<FBBrandDto>();

    public async Task<IEnumerable<FBOutletDto>> ListOutlets(string d, string st, string? sid, string per)
        // => (await _cache.GetOrSetAsync(K("outlets", brand ?? "all"), _ttl, async () => (await _repo.ListOutlets(brand)).ToList())) ?? Enumerable.Empty<FBOutletDto>();
        => (await _repo.ListOutlets(d, st, sid, per)) ?? Enumerable.Empty<FBOutletDto>();

    public Task<FBSummaryDto> GetSummary(string d, string st, string? sid, string per)
      //  => _cache.GetOrSetAsync(K("summary", d, st, sid ?? "_"), _ttl, () => _repo.GetSummary(d, st, sid,per))!;
      => _repo.GetSummary(d, st, sid, per);

    public async Task<IEnumerable<FBBrandDto>> GetBrandSummary(string d, string st, string? sid, string per)
    //    => (await _cache.GetOrSetAsync(K("bsummary", d, st, sid ?? "_"), _ttl, async () => (await _repo.GetBrandSummary(d, st, sid,per)).ToList())) ?? Enumerable.Empty<FBBrandDto>();
            => (await _repo.GetBrandSummary(d, st, sid, per)) ?? Enumerable.Empty<FBBrandDto>();


    public async Task<IEnumerable<FBAggregatorDto>> GetAggregators(string d, string st, string? sid,string per)
                => (await _repo.GetAggregators(d, st, sid,per)) ?? Enumerable.Empty<FBAggregatorDto>();

    // => (await _cache.GetOrSetAsync(K("agg", d, st, sid ?? "_"), _ttl, async () => (await _repo.GetAggregators(d, st, sid)).ToList())) ?? Enumerable.Empty<FBAggregatorDto>();

    public async Task<IEnumerable<FBPaymentDto>> GetPayments(string d, string st, string? sid, string per)
                => (await _repo.GetPayments(d, st, sid, per)) ?? Enumerable.Empty<FBPaymentDto>();

    public Task<FBChannelMixDto> GetChannels(string d, string st, string? sid,string per)
                => _repo.GetChannels(d, st, sid, per);

    //  => (await _cache.GetOrSetAsync(K("pay", d, st, sid ?? "_"), _ttl, async () => (await _repo.GetPayments(d, st, sid)).ToList())) ?? Enumerable.Empty<FBPaymentDto>();

    public async Task<IEnumerable<FBBrandDto>> GetDeliveryByBrand(string d, string st, string? sid,string per)
                => (await _repo.GetDeliveryByBrand(d, st, sid, per)) ?? Enumerable.Empty<FBBrandDto>();

    //  => (await _cache.GetOrSetAsync(K("delivery", d, st, sid ?? "_"), _ttl, async () => (await _repo.GetDeliveryByBrand(d, st, sid)).ToList())) ?? Enumerable.Empty<FBBrandDto>();

    public async Task<IEnumerable<FBOutletDto>> GetTopOutlets(string d, string st, string? sid,string per, int limit)
                => (await _repo.GetTopOutlets(d, st, sid, per,limit)) ?? Enumerable.Empty<FBOutletDto>();

    // => (await _cache.GetOrSetAsync(K("top", d, st, sid ?? "_", limit), _ttl, async () => (await _repo.GetTopOutlets(d, st, sid, limit)).ToList())) ?? Enumerable.Empty<FBOutletDto>();

    public async Task<IEnumerable<FBTrendDto>> GetTrend(string d, string st, string? sid, string per)
                => (await _repo.GetTrend(d, st, sid, per))?.ToList() ?? Enumerable.Empty<FBTrendDto>();
}
