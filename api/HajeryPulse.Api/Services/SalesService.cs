using HajeryPulse.Api.Data.Repositories;
using HajeryPulse.Api.Models.Dto;

namespace HajeryPulse.Api.Services;

public interface ISalesService
{
    Task<WTSummaryDto>          GetSummary(string asOfDate, string bt, string period);
    Task<MarginAnalysisDto>     GetMargin(string asOfDate, string bt, string period);
    Task<SalesQualityDto>       GetQuality(string asOfDate, string bt, string period);
    Task<OrgNodeDto>            GetOrgNode(string asOfDate, string bt, string parent, string period);
    Task<IEnumerable<TopBrandDto>>    GetTopBrands(string asOfDate, string bt, string period, int limit,string parent);
    Task<IEnumerable<TopCustomerDto>> GetTopCustomers(string asOfDate, string bt, string period, int limit,string parent);
}

public sealed class SalesService : ISalesService
{
    private readonly ISalesRepository _repo;

    public SalesService(ISalesRepository repo)
    {
        _repo = repo;
    }

    public Task<WTSummaryDto> GetSummary(string asOfDate, string bt, string period = "week")
        => _repo.GetSummary(asOfDate, bt, period);

    public Task<MarginAnalysisDto> GetMargin(string asOfDate, string bt, string period = "week")
        => _repo.GetMargin(asOfDate, bt, period);

    public Task<SalesQualityDto> GetQuality(string asOfDate, string bt, string period = "week")
        => _repo.GetQuality(asOfDate, bt, period);

    public Task<OrgNodeDto> GetOrgNode(string asOfDate, string bt, string parent, string period = "week")
        => _repo.GetOrgNode(asOfDate, bt, parent, period);

    public async Task<IEnumerable<TopBrandDto>> GetTopBrands(string asOfDate, string bt, string period, int limit, string parent = "root")
        => (await _repo.GetTopBrands(asOfDate, bt, period, limit, parent)) ?? Enumerable.Empty<TopBrandDto>();

    public async Task<IEnumerable<TopCustomerDto>> GetTopCustomers(string asOfDate, string bt, string period, int limit, string parent = "root")
        => (await _repo.GetTopCustomers(asOfDate, bt, period, limit,parent)) ?? Enumerable.Empty<TopCustomerDto>();
}