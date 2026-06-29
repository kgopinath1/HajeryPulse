using HajeryPulse.Api.Data.Repositories;
using HajeryPulse.Api.Models.Dto;

namespace HajeryPulse.Api.Services;

public interface IFinanceService
{
    Task<FinanceHealthDto> GetHealth(string asOfDate);
    Task<OpsSummaryDto>    GetOps(string asOfDate);
}

public sealed class FinanceService : IFinanceService
{
    private readonly IFinanceRepository _repo;
    //private readonly ICacheService _cache;
    //private readonly TimeSpan _ttl;

    //public FinanceService(IFinanceRepository repo, ICacheService cache, IConfiguration config)
    //{
    //    _repo  = repo;
    //    _cache = cache;
    //    _ttl   = TimeSpan.FromSeconds(config.GetValue<int>("Cache:DashboardTtlSeconds", 600));
    //}
    public FinanceService(IFinanceRepository repo, IConfiguration config)
    {
        _repo = repo;
       
    }

    public Task<FinanceHealthDto> GetHealth(string asOfDate)
          => _repo.GetHealth(asOfDate);
    //=> _cache.GetOrSetAsync($"hp:fin:health:{asOfDate}", _ttl, () => _repo.GetHealth(asOfDate))!;

    public Task<OpsSummaryDto> GetOps(string asOfDate)
        => _repo.GetOps(asOfDate);
    //=> _cache.GetOrSetAsync($"hp:fin:ops:{asOfDate}",    _ttl, () => _repo.GetOps(asOfDate))!;
}
