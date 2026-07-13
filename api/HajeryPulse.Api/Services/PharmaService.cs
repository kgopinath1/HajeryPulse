using System.Runtime.CompilerServices;
using HajeryPulse.Api.Data.Repositories;
using HajeryPulse.Api.Models.Dto;

namespace HajeryPulse.Api.Services;

public interface IPharmaService
{
    Task<IEnumerable<PharmacyDto>>          ListPharmacies(string asOfDate,  string period = "week");
    Task<PharmaSummaryDto>                  GetSummary(string asOfDate, string pharmacyId, string period = "week");
    Task<PharmaMarginDto>                   GetMargin(string asOfDate, string pharmacyId, string period = "week");
    Task<PharmaSalesQualityDto>             GetQuality(string asOfDate, string pharmacyId, string period = "week");
    Task<List<PharmaChannelDto>>                GetChannels(string asOfDate, string pharmacyId, string period = "week");
    Task<IEnumerable<PharmaPaymentDto>>     GetPayments(string asOfDate, string pharmacyId, string period = "week");
    Task<IEnumerable<PharmaCategoryDto>>    GetCategories(string asOfDate, string pharmacyId, int limit,string period = "week");
    Task<PharmaRxOtcMixDto>                 GetRxOtcMix(string asOfDate, string pharmacyId, string period = "week");
    Task<IEnumerable<PharmaDiscountDto>>    GetDiscountLeaderboard(string asOfDate, int limit,string period = "week");
    Task<IEnumerable<PharmacyDto>>          GetTopPharmacies(string asOfDate, int limit,string period = "week");
    Task<PharmaTrendDto>        GetTrend(string asOfDate, string pharmacyId, string period = "week");
}

public sealed class PharmaService : IPharmaService
{
    private readonly IPharmaRepository _repo;
   // private readonly ICacheService _cache;
    //private readonly TimeSpan _ttl;

    //public PharmaService(IPharmaRepository repo, ICacheService cache, IConfiguration config)
    //{
    //    _repo  = repo;
    //    _cache = cache;
    //    _ttl   = TimeSpan.FromSeconds(config.GetValue<int>("Cache:DashboardTtlSeconds", 600));
    //}
    public PharmaService(IPharmaRepository repo, IConfiguration config)
    {
        _repo = repo;
        //_cache = cache;
        //_ttl = TimeSpan.FromSeconds(config.GetValue<int>("Cache:DashboardTtlSeconds", 600));
    }

    private static string K(string s, params object?[] p) => $"hp:pharma:{s}:" + string.Join(":", p);

    //    public async Task<IEnumerable<PharmacyDto>> ListPharmacies()

    //        => (await _cache.GetOrSetAsync(K("list"), _ttl, async () => (await _repo.ListPharmacies()).ToList())) ?? Enumerable.Empty<PharmacyDto>();

    //    public Task<PharmaSummaryDto> GetSummary(string d, string id)
    //        => _cache.GetOrSetAsync(K("summary", d, id), _ttl, () => _repo.GetSummary(d, id))!;

    //    public Task<PharmaMarginDto> GetMargin(string d, string id)
    //        => _cache.GetOrSetAsync(K("margin", d, id), _ttl, () => _repo.GetMargin(d, id))!;

    //    public Task<SalesQualityDto> GetQuality(string d, string id)
    //        => _cache.GetOrSetAsync(K("quality", d, id), _ttl, () => _repo.GetQuality(d, id))!;

    //    public Task<PharmaChannelDto> GetChannels(string d, string id)
    //        => _cache.GetOrSetAsync(K("channels", d, id), _ttl, () => _repo.GetChannels(d, id))!;

    //    public async Task<IEnumerable<PharmaPaymentDto>> GetPayments(string d, string id)
    //        => (await _cache.GetOrSetAsync(K("pay", d, id), _ttl, async () => (await _repo.GetPayments(d, id)).ToList())) ?? Enumerable.Empty<PharmaPaymentDto>();

    //    public async Task<IEnumerable<PharmaCategoryDto>> GetCategories(string d, string id, int limit)
    //        => (await _cache.GetOrSetAsync(K("cat", d, id, limit), _ttl, async () => (await _repo.GetCategories(d, id, limit)).ToList())) ?? Enumerable.Empty<PharmaCategoryDto>();

    //    public Task<PharmaRxOtcMixDto> GetRxOtcMix(string d, string id)
    //        => _cache.GetOrSetAsync(K("rxotc", d, id), _ttl, () => _repo.GetRxOtcMix(d, id))!;

    //    public async Task<IEnumerable<PharmaDiscountDto>> GetDiscountLeaderboard(string d, int limit)
    //        => (await _cache.GetOrSetAsync(K("disc", d, limit), _ttl, async () => (await _repo.GetDiscountLeaderboard(d, limit)).ToList())) ?? Enumerable.Empty<PharmaDiscountDto>();

    //    public async Task<IEnumerable<PharmacyDto>> GetTopPharmacies(string d, int limit)
    //        => (await _cache.GetOrSetAsync(K("top", d, limit), _ttl, async () => (await _repo.GetTopPharmacies(d, limit)).ToList())) ?? Enumerable.Empty<PharmacyDto>();
    //}

    public async Task<IEnumerable<PharmacyDto>> ListPharmacies(string d,  string period = "week")
        => (await _repo.ListPharmacies(d,  period)) ?? Enumerable.Empty<PharmacyDto>();

    public Task<PharmaSummaryDto> GetSummary(string d, string id, string period = "week")
        => _repo.GetSummary(d, id, period);

    public Task<PharmaTrendDto> GetTrend(string d, string id, string period = "week")
        => _repo.GetTrend(d, id, period);

    public Task<PharmaMarginDto> GetMargin(string d, string id, string period = "week")
        => _repo.GetMargin(d, id,period);

    public Task<PharmaSalesQualityDto> GetQuality(string d, string id, string period = "week")
        => _repo.GetQuality(d, id, period);

public Task<List<PharmaChannelDto>> GetChannels(
    string d, string id, string period = "week")
    => _repo.GetChannels(d, id, period);

    public async Task<IEnumerable<PharmaPaymentDto>> GetPayments(string d, string id, string period = "week")
        => (await _repo.GetPayments(d, id, period)) ?? Enumerable.Empty<PharmaPaymentDto>();

    public async Task<IEnumerable<PharmaCategoryDto>> GetCategories(string d, string id, int limit,string period = "week")
        => (await _repo.GetCategories(d, id, limit, period)) ?? Enumerable.Empty<PharmaCategoryDto>();

    public Task<PharmaRxOtcMixDto> GetRxOtcMix(string d, string id, string period = "week")
        => _repo.GetRxOtcMix(d, id, period);

    public async Task<IEnumerable<PharmaDiscountDto>> GetDiscountLeaderboard(string d, int limit,string period="week")
        => (await _repo.GetDiscountLeaderboard(d, limit, period)) ?? Enumerable.Empty<PharmaDiscountDto>();

    public async Task<IEnumerable<PharmacyDto>> GetTopPharmacies(string d ,int limit,string period = "week")
        => (await _repo.GetTopPharmacies(d,limit,period)) ?? Enumerable.Empty<PharmacyDto>();
}