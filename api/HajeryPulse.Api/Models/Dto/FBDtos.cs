namespace HajeryPulse.Api.Models.Dto;

public sealed record FBBrandDto(
    string Id, string Name, decimal AmtKwd, decimal YoyPct,
    string Color, decimal DeliveryKwd, int OutletCount);

public sealed record FBOutletDto(
    string Code, string Name, string BrandId, decimal AmtKwd, decimal YoyPct);

public sealed record FBScopeDto(string Type, string? Id, string Name);

public sealed record FBSummaryDto(
    FBScopeDto Scope, decimal RevenueKwd, int Covers,
    decimal TicketKwd, int OutletsActive, int OutletsTotal, decimal YoyPct);

public sealed record FBAggregatorDto(string Key, string Label, decimal Kwd, decimal Pct, string Color);
public sealed record FBPaymentDto(string Key, string Label, decimal Kwd, decimal Pct, string Color);
