namespace HajeryPulse.Api.Models.Dto;

public sealed record InboxListResponse(IReadOnlyList<ApprovalSummaryDto> Items);

public sealed record ApprovalSummaryDto(
    string Id, string Type, string Title,
    decimal AmountKwd, string Requester,
    DateTime SubmittedAt, string Status);

public sealed record ApprovalDetailDto(
    string Id, string Type, string Title, string Description,
    decimal AmountKwd, string Requester, string BuCode,
    DateTime SubmittedAt, string Status,
    IReadOnlyList<ApprovalLineItemDto> LineItems,
    IReadOnlyList<ApprovalAttachmentDto> Attachments,
    IReadOnlyList<ApprovalHistoryDto> History);

public sealed record ApprovalLineItemDto(
    int ItemNo, string Description, decimal Qty, decimal UnitPriceKwd, string Vendor);

public sealed record ApprovalAttachmentDto(string FileName, long SizeBytes, string Url);

public sealed record ApprovalHistoryDto(DateTime OccurredAt, string User, string Action, string? Comment);

public sealed record ApprovalActionRequest(string Comment);
public sealed record ApprovalClarifyRequest(string Question);
public sealed record ApprovalActionResponse(string Id, string Status, DateTime DecidedAt);

public sealed record FinanceHealthDto(
    decimal GrossMarginPct, decimal TargetPct, decimal PreviousPct,
    int ArDaysOutstanding, int ApDaysOutstanding,
    decimal WorkingCapitalKwd, decimal CashOnHandKwd);

public sealed record OpsSummaryDto(
    decimal FillRatePct, decimal SlaCompliancePct,
    decimal AvgDispatchHours, int OpenServiceTickets);
