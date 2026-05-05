using System.Data;
using Dapper;
using HajeryPulse.Api.Models.Dto;

namespace HajeryPulse.Api.Data.Repositories;

public interface IInboxRepository
{
    Task<IEnumerable<ApprovalSummaryDto>> ListInbox(string userId, string status, int limit);
    Task<ApprovalDetailDto>               GetDetail(string userId, string requestId);
    Task<ApprovalActionResponse>          Approve(string userId, string requestId, string comment);
    Task<ApprovalActionResponse>          Reject (string userId, string requestId, string comment);
    Task<ApprovalActionResponse>          Clarify(string userId, string requestId, string question);
}

public sealed class InboxRepository : IInboxRepository
{
    private readonly IDbConnectionFactory _factory;
    public InboxRepository(IDbConnectionFactory f) => _factory = f;

    public async Task<IEnumerable<ApprovalSummaryDto>> ListInbox(string userId, string status, int limit)
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryAsync<ApprovalSummaryDto>("app.sp_GetInbox",
            new { UserEntraId = userId, Status = status, Limit = limit },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<ApprovalDetailDto> GetDetail(string userId, string requestId)
    {
        using var c = await _factory.OpenAsync();
        using var multi = await c.QueryMultipleAsync("app.sp_GetApprovalDetail",
            new { UserEntraId = userId, RequestId = requestId },
            commandType: CommandType.StoredProcedure);

        var head        = await multi.ReadFirstAsync<dynamic>();
        var lineItems   = (await multi.ReadAsync<ApprovalLineItemDto>()).ToList();
        var attachments = (await multi.ReadAsync<ApprovalAttachmentDto>()).ToList();
        var history     = (await multi.ReadAsync<ApprovalHistoryDto>()).ToList();

        return new ApprovalDetailDto(
            (string)head.Id, (string)head.Type, (string)head.Title, (string)head.Description,
            (decimal)head.AmountKwd, (string)head.Requester, (string)head.BuCode,
            (DateTime)head.SubmittedAt, (string)head.Status,
            lineItems, attachments, history);
    }

    public async Task<ApprovalActionResponse> Approve(string userId, string requestId, string comment)
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryFirstAsync<ApprovalActionResponse>("app.sp_ApproveRequest",
            new { UserEntraId = userId, RequestId = requestId, Comment = comment },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<ApprovalActionResponse> Reject(string userId, string requestId, string comment)
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryFirstAsync<ApprovalActionResponse>("app.sp_RejectRequest",
            new { UserEntraId = userId, RequestId = requestId, Comment = comment },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<ApprovalActionResponse> Clarify(string userId, string requestId, string question)
    {
        using var c = await _factory.OpenAsync();
        return await c.QueryFirstAsync<ApprovalActionResponse>("app.sp_ClarifyRequest",
            new { UserEntraId = userId, RequestId = requestId, Question = question },
            commandType: CommandType.StoredProcedure);
    }
}
