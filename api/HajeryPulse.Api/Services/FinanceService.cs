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

    public FinanceService(IFinanceRepository repo)
    {
        _repo = repo;
    }

    public Task<FinanceHealthDto> GetHealth(string asOfDate)
          => _repo.GetHealth(asOfDate);

    public Task<OpsSummaryDto> GetOps(string asOfDate)
        => _repo.GetOps(asOfDate);
}
