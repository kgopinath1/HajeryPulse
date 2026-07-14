namespace HajeryPulse.Api.Models.Dto;

public sealed record HomeDto(
    decimal TotalRevenueKwd,
    decimal GrowthPct,
    string GrowthType,
    decimal FbRevenueKwd,
    decimal PharmaRevenueKwd);


  public sealed record HomeQuickKpisDto(
    int TotalOrders,
    decimal OrdersDeltaPct,
    decimal AvgOrderValueKwd,
    decimal AvgOrderValueDeltaPct,
    decimal GrossMarginPct,
    decimal GrossMarginDeltaPp,
    decimal FulfillmentPct,
    decimal FulfillmentDeltaPp,
    string GrowthType);