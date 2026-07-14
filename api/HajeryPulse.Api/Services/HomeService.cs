using HajeryPulse.Api.Data.Repositories;
using HajeryPulse.Api.Models.Dto;

namespace HajeryPulse.Api.Services;

public interface IHomeService
{
    Task<HomeDto> GetCombinedRevenue(string asOfDate, string period);
    Task<HomeQuickKpisDto> GetQuickKpis(string asOfDate);
}


public sealed class HomeService : IHomeService
{
    private readonly IHomeRepository _repo;

    public HomeService(IHomeRepository repo)
    {
        _repo = repo;
    }

    public Task<HomeDto> GetCombinedRevenue(string asOfDate, string period)
        => _repo.GetCombinedRevenue(asOfDate, period);

         public Task<HomeQuickKpisDto> GetQuickKpis(string asOfDate)
        => _repo.GetQuickKpis(asOfDate);
}