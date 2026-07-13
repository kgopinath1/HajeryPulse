namespace HajeryPulse.Api.Models.Dto;

public sealed record FBBrandDto(
    string Id, string Name, decimal AmtKwd, 
    string Color, int OutletCount,decimal GrowthPct,
    string GrowthType, decimal YoyPct, decimal DeliveryKwd );

public sealed record FBOutletDto(
    string Code, string Name, string BrandId,
    decimal AmtKwd, decimal GrowthPct, string GrowthType, decimal YoyPct);

public sealed record FBScopeDto(string Type, string? Id, string Name);

public sealed record FBSummaryDto(
    FBScopeDto Scope, decimal RevenueKwd, int Covers, decimal CoversDelta,
    decimal TicketKwd, decimal TicketKwdDelta,int OutletsActive, int OutletsTotal,
decimal GrowthPct,
    string GrowthType, decimal YoyPct
);

public sealed record FBAggregatorDto(string Key, string Label, decimal Kwd, decimal Pct, string Color);
public sealed record FBPaymentDto(string Key, string Label, decimal Kwd, decimal Pct, string Color);
public sealed record FBChannelMixDto(
    string ChannelCode,
    string ChannelName,
    decimal Kwd,
    decimal Pct
);

public sealed record FBTrendDto(
    decimal[] Current,
    decimal[] Previous

);
