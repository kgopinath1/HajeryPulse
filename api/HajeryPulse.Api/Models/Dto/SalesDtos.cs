namespace HajeryPulse.Api.Models.Dto;

public sealed record WTSummaryDto(
    string AsOfDate,
    string Bt,
    RevenuePoint Revenue,
    WTKpis Kpis,
    decimal[] Spark);

public sealed record RevenuePoint(decimal Kwd, decimal Wow);
public sealed record WTKpis(int NewOrders, decimal OpenOrderValueKwd, int ActiveTenders, decimal AvgTenderValueKwd);

public sealed record MarginAnalysisDto(
    decimal MarginPct, decimal MarginPctLY, decimal MarginYoyPp,
    decimal NetSalesKwd, decimal CogsKwd, decimal GrossMarginKwd,
    decimal[] Trend12mo, decimal[] Trend12moLY);

public sealed record SalesQualityDto(
    decimal GrossKwd, decimal ReturnsKwd, decimal CancellationsKwd,
    decimal NetKwd, decimal NetPct, decimal ReturnsPct, decimal CancellationsPct);

public sealed record OrgNodeDto(
    string Level, string Label, string ParentKey, OrgChildDto[] Children);

public sealed record OrgChildDto(
    string Key, string Code, string Name,
    decimal AmtW, decimal AmtT, decimal Yoy, bool HasChildren);

public sealed record TopBrandDto(
    int Rank, string Brand, string Segment, decimal AmountKwd, decimal YoyPct);

public sealed record TopCustomerDto(
    int Rank, string Customer, string Type, int OrdersThisWeek, decimal AmountKwd, decimal YoyPct);
