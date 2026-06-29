using HajeryPulse.Api.Data.Repositories;
using HajeryPulse.Api.Models.Dto;

namespace HajeryPulse.Api.Services;

public interface ISalesService
{
    Task<WTSummaryDto>          GetSummary(string asOfDate, string bt, string period);
    Task<MarginAnalysisDto>     GetMargin(string asOfDate, string bt);
    Task<SalesQualityDto>       GetQuality(string asOfDate, string bt, string period);
    Task<OrgNodeDto>            GetOrgNode(string asOfDate, string bt, string parent, string period);
    Task<IEnumerable<TopBrandDto>>    GetTopBrands(string asOfDate, string bt, string period, int limit);
    Task<IEnumerable<TopCustomerDto>> GetTopCustomers(string asOfDate, string bt, string period, int limit);
}

public sealed class SalesService : ISalesService
{
    private readonly ISalesRepository _repo;
    //private readonly ICacheService _cache;
    //private readonly TimeSpan _ttl;

    //public SalesService(ISalesRepository repo, ICacheService cache, IConfiguration config)
    //{
    //    _repo = repo;
    //    _cache = cache;
    //    var seconds = config.GetValue<int>("Cache:DashboardTtlSeconds", 600);
    //    _ttl = TimeSpan.FromSeconds(seconds);
    //}
    public SalesService(ISalesRepository repo, IConfiguration config)
    {
        _repo = repo;
       // _cache = cache;
        var seconds = config.GetValue<int>("Cache:DashboardTtlSeconds", 600);
       // _ttl = TimeSpan.FromSeconds(seconds);
    }


    //    private static string Key(string segment, params object?[] parts)
    //        => $"hp:sales:{segment}:" + string.Join(":", parts);

    //    public Task<WTSummaryDto> GetSummary(string asOfDate, string bt)
    //        => _cache.GetOrSetAsync(Key("summary", asOfDate, bt), _ttl, () => _repo.GetSummary(asOfDate, bt))!;

    //    public Task<MarginAnalysisDto> GetMargin(string asOfDate, string bt)
    //        => _cache.GetOrSetAsync(Key("margin", asOfDate, bt), _ttl, () => _repo.GetMargin(asOfDate, bt))!;

    //    public Task<SalesQualityDto> GetQuality(string asOfDate, string bt)
    //        => _cache.GetOrSetAsync(Key("quality", asOfDate, bt), _ttl, () => _repo.GetQuality(asOfDate, bt))!;

    //    public Task<OrgNodeDto> GetOrgNode(string asOfDate, string bt, string parent)
    //        => _cache.GetOrSetAsync(Key("org", asOfDate, bt, parent), _ttl, () => _repo.GetOrgNode(asOfDate, bt, parent))!;

    //    public async Task<IEnumerable<TopBrandDto>> GetTopBrands(string asOfDate, string bt, int limit)
    //    {
    //        var list = await _cache.GetOrSetAsync(Key("topBrands", asOfDate, bt, limit), _ttl,
    //            async () => (await _repo.GetTopBrands(asOfDate, bt, limit)).ToList());
    //        return list ?? Enumerable.Empty<TopBrandDto>();
    //    }

    //    public async Task<IEnumerable<TopCustomerDto>> GetTopCustomers(string asOfDate, string bt, int limit)
    //    {
    //        var list = await _cache.GetOrSetAsync(Key("topCust", asOfDate, bt, limit), _ttl,
    //            async () => (await _repo.GetTopCustomers(asOfDate, bt, limit)).ToList());
    //        return list ?? Enumerable.Empty<TopCustomerDto>();
    //    }
    //}

    public Task<WTSummaryDto> GetSummary(string asOfDate, string bt, string period = "week")
        => _repo.GetSummary(asOfDate, bt, period);

    public Task<MarginAnalysisDto> GetMargin(string asOfDate, string bt)
        => _repo.GetMargin(asOfDate, bt);

    public Task<SalesQualityDto> GetQuality(string asOfDate, string bt, string period = "week")
        => _repo.GetQuality(asOfDate, bt, period);

    public Task<OrgNodeDto> GetOrgNode(string asOfDate, string bt, string parent, string period = "week")
        => _repo.GetOrgNode(asOfDate, bt, parent, period);

    public async Task<IEnumerable<TopBrandDto>> GetTopBrands(string asOfDate, string bt, string period, int limit)
        => (await _repo.GetTopBrands(asOfDate, bt, period, limit)) ?? Enumerable.Empty<TopBrandDto>();

    public async Task<IEnumerable<TopCustomerDto>> GetTopCustomers(string asOfDate, string bt, string period, int limit)
        => (await _repo.GetTopCustomers(asOfDate, bt, period, limit)) ?? Enumerable.Empty<TopCustomerDto>();
}