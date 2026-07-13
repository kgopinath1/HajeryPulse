namespace HajeryPulse.Api.Models.Dto;

public  record PharmacyDto(string Id, string Name, decimal AmtKwd);

public sealed record PharmaSummaryDto(
    PharmacyDto Pharmacy,
    decimal RevenueKwd,
    int Transactions,
    decimal DeltaTxns,
    decimal PrevBasketSizeKwd,
    decimal DeltaBasketSizeKwd,
    decimal BasketSizeKwd,
    int StoresActive,
    int StoresTotal,
    decimal GrowthPct,
    string GrowthType,
    decimal YoyPct
);

public sealed record PharmaMarginDto(
    decimal GrossKwd,
    decimal DiscountKwd,
    decimal CogsKwd,
    decimal MarginKwd,
    decimal NetSalesKwd,

    decimal MarginPct,
    decimal MarginPctLY,
    decimal MarginDeviationPp,

    decimal LyGrossKwd,
    decimal LyNetSalesKwd,
    decimal LyCogsKwd,

    decimal GrossYoyPct,
    decimal CogsYoyPct,
    decimal GrossMarginYoyPct,
    decimal DiscountPct,

    string GrowthType,

    decimal[] Trend,
    decimal[] TrendLY
);

public sealed record PharmaChannelDto(
    string ChannelCode,
    string ChannelName,
    decimal Kwd,
    decimal Pct
);
    public sealed record PharmaSalesQualityDto(
    decimal GrossKwd, decimal ReturnsKwd, decimal CancellationsKwd,
    decimal NetKwd, decimal NetPct, decimal ReturnsPct, decimal ReturnsPctPrev, string GrowthType,decimal ReturnsPctPp ,decimal NetPctPp);

public sealed record PharmaPaymentDto(string Key, string Label, decimal Kwd, decimal Pct, string Color);
public sealed record PharmaCategoryDto(string Key, string Label, decimal Kwd, decimal Pct);
public sealed record PharmaDiscountDto(string Id, string Name, decimal RatePct, decimal DiscountKwd);
public sealed record PharmaRxOtcMixDto(decimal RxPct, decimal OtcPct, decimal RxKwd, decimal OtcKwd, decimal RxYoyPp,decimal RxYoyPct,  decimal OtcYoyPct,string GrowthType);
public sealed record PharmaTrendDto(decimal[] Current, decimal[] Previous);
