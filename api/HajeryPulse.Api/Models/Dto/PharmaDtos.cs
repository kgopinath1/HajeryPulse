namespace HajeryPulse.Api.Models.Dto;

public sealed record PharmacyDto(string Id, string Name, decimal AmtKwd);

public sealed record PharmaSummaryDto(
    PharmacyDto Pharmacy,
    decimal RevenueKwd, int Transactions, decimal BasketSizeKwd,
    int StoresActive, int StoresTotal, decimal RxSharePct);

public sealed record PharmaMarginDto(
    decimal GrossKwd, decimal DiscountKwd, decimal CogsKwd, decimal MarginKwd,
    decimal NetSalesKwd, decimal MarginPct, decimal MarginPctLY);

public sealed record PharmaChannelDto(
    decimal InstoreKwd, decimal CallcenterKwd, decimal AggregatorKwd);

public sealed record PharmaPaymentDto(string Key, string Label, decimal Kwd, decimal Pct, string Color);
public sealed record PharmaCategoryDto(string Key, string Label, decimal Kwd, decimal Pct);
public sealed record PharmaDiscountDto(string Id, string Name, decimal RatePct, decimal DiscountKwd);
public sealed record PharmaRxOtcMixDto(decimal RxPct, decimal OtcPct, decimal RxKwd, decimal OtcKwd, decimal RxYoyPp);
