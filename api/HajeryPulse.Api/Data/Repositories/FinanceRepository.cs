using System.Data;
using Dapper;
using HajeryPulse.Api.Models.Dto;

namespace HajeryPulse.Api.Data.Repositories;

public interface IFinanceRepository
{
    Task<FinanceHealthDto> GetHealth(string asOfDate);
    Task<OpsSummaryDto>    GetOps(string asOfDate);
}

public sealed class FinanceRepository : IFinanceRepository
{
    private readonly IDbConnectionFactory _factory;
    public FinanceRepository(IDbConnectionFactory f) => _factory = f;

    public async Task<FinanceHealthDto> GetHealth(string asOfDate)
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryFirstAsync<FinanceHealthDto>("app.sp_GetFinanceHealth",
            new { AsOfDate = asOfDate }, commandType: CommandType.StoredProcedure);
    }

    public async Task<OpsSummaryDto> GetOps(string asOfDate)
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryFirstAsync<OpsSummaryDto>("app.sp_GetOpsSummary",
            new { AsOfDate = asOfDate }, commandType: CommandType.StoredProcedure);
    }
}
