namespace HajeryPulse.Api.Models.Dto;

public sealed record WTSummaryDto(
    string AsOfDate,
    string Bt,
    string Period,
    RevenuePoint Revenue,
    WTKpis Kpis,
    decimal[] Spark,decimal[] SparkLY);

public sealed record RevenuePoint(decimal Kwd, decimal Wow,string GrowthType);
public sealed record WTKpis(int NewOrders, decimal AvgOrderValueKwd, decimal AvgOrderValuePct, decimal PipelineAmount, int ActiveTenders, decimal AvgTenderValueKwd,decimal AvgTenderValuePct);

public sealed record MarginAnalysisDto(
    decimal MarginPct,
    decimal MarginPctLY,
    decimal MarginYoyPp,

    decimal NetSalesKwd,
    decimal CogsKwd,
    decimal GrossMarginKwd,

  
    decimal SalesYoyPct,
    decimal CogsYoyPct,
    decimal GrossMarginYoyPct,

    decimal[] Trend12mo,
    decimal[] Trend12moLY
);

public sealed record SalesQualityDto(
    decimal GrossKwd, decimal ReturnsKwd, decimal CancellationsKwd,
    decimal NetKwd, decimal NetPct, decimal ReturnsPct, decimal ReturnsPctDelta,decimal CancellationsPct,  decimal NetPctDelta );

public sealed record OrgNodeDto(
    string Level, string Label, string ParentKey, OrgChildDto[] Children);

public sealed record OrgChildDto(
    string Key, string Code, string Name,
    decimal AmtW, decimal AmtT, decimal Total,decimal YoyPct, int HasChildren,string GrowthType,decimal SharePct);

public sealed record TopBrandDto(
    long Rank, string BrandCode, string Brand, string Segment, decimal AmountKwd, decimal YoyPct,string GrowthType);

public sealed record TopCustomerDto(
    long Rank, string Customer, string Type, int OrdersThisPeriod, decimal AmountKwd, decimal YoyPct,string GrowthType);
