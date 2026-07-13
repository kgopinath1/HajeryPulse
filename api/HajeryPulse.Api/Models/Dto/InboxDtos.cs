namespace HajeryPulse.Api.Models.Dto;
public sealed record UserDto(
    int Id,
    string Name,
    string Role,
    string Email,
    string Department,
    int MustResetPassword,
    string Prefix,
    string AdId,
    string Designation
);
 public sealed record InboxListResponse(IReadOnlyList<ApprovalSummaryDto> Items);


public sealed record ApprovalSummaryDto(
    int Id,
    string Type,
    string Title,
    decimal Amount,
    string Requester,
    DateTime SubmittedAt,
    string Status
);


public sealed record ApprovalDetailDto(
    int Id,
    string Type,
    string Title,
    string? Description,
    decimal Amount,
    string Requester,
    DateTime CreatedAt,
    string Status,
    IReadOnlyList<ApprovalLineItemDto> LineItems,
    IReadOnlyList<ApprovalAttachmentDto> Attachments,
    IReadOnlyList<ApprovalHistoryDto> History
);

public sealed record ApprovalLineItemDto(
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal Total
);

public sealed record ApprovalAttachmentDto(
    string Name,
    string Url
);

public sealed record ApprovalHistoryDto(DateTime OccurredAt, string User, string Action, string? Comment);

public sealed record ApprovalActionRequest(string Comment);
public sealed record ApprovalClarifyRequest(string Question);
public sealed record ApprovalActionResponse(
    int RequestId,
    string Status,
    DateTime UpdatedAt);

public sealed record FinanceHealthDto(
    decimal GrossMarginPct, decimal TargetPct, decimal PreviousPct,
    int ArDaysOutstanding, int ApDaysOutstanding,
    decimal WorkingCapitalKwd, decimal CashOnHandKwd);

public sealed record OpsSummaryDto(
    decimal FillRatePct, decimal SlaCompliancePct,
    decimal AvgDispatchHours, int OpenServiceTickets);
 