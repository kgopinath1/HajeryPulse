/* ============================================================================
   Script 032: F&B stored procedures.
   ============================================================================ */
USE HajeryPulse_Reporting;
GO

-- ============================================================================
-- sp_GetFBBrands — list of all 12 brands with weekly totals + outlet count
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetFBBrands
    @AsOfDate DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @asOf DATE = ISNULL(@AsOfDate, DATEADD(DAY, -1, CAST(SYSUTCDATETIME() AS DATE)));
    DECLARE @asOfKey   INT = CONVERT(INT, FORMAT(@asOf, 'yyyyMMdd'));
    DECLARE @weekStart INT = CONVERT(INT, FORMAT(DATEADD(DAY, -6, @asOf), 'yyyyMMdd'));

    ;WITH delivery AS (
        SELECT o.FBBrandKey,
               SUM(CASE WHEN ch.Code = 'delivery' THEN f.NetKwd ELSE 0 END) AS DeliveryNet
        FROM fact.FBSales f
        JOIN dim.FBOutlet o  ON o.FBOutletKey = f.FBOutletKey
        LEFT JOIN ref.Channel ch ON ch.ChannelKey = f.ChannelKey
        WHERE f.DateKey BETWEEN @weekStart AND @asOfKey
        GROUP BY o.FBBrandKey
    )
    SELECT
        b.Code               AS Id,
        b.Name               AS Name,
        ISNULL(SUM(f.NetKwd), 0) / 1000.0 AS AmtKwd,
        CONVERT(DECIMAL(5,2), 12.0) AS YoyPct,         -- TODO: real YoY
        ISNULL(b.BrandColor, '#bdc3c7') AS Color,
        ISNULL((SELECT DeliveryNet FROM delivery d WHERE d.FBBrandKey = b.FBBrandKey), 0) / 1000.0 AS DeliveryKwd,
        (SELECT COUNT(*) FROM dim.FBOutlet o WHERE o.FBBrandKey = b.FBBrandKey AND o.IsActive = 1) AS OutletCount
    FROM dim.FBBrand b
    LEFT JOIN dim.FBOutlet o   ON o.FBBrandKey  = b.FBBrandKey
    LEFT JOIN fact.FBSales f   ON f.FBOutletKey = o.FBOutletKey
                                 AND f.DateKey BETWEEN @weekStart AND @asOfKey
    WHERE b.IsActive = 1
    GROUP BY b.FBBrandKey, b.Code, b.Name, b.BrandColor
    ORDER BY AmtKwd DESC;
END;
GO

-- ============================================================================
-- sp_GetFBOutlets
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetFBOutlets
    @Brand    NVARCHAR(20) = NULL,
    @AsOfDate DATE         = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @asOf DATE = ISNULL(@AsOfDate, DATEADD(DAY, -1, CAST(SYSUTCDATETIME() AS DATE)));
    DECLARE @asOfKey   INT = CONVERT(INT, FORMAT(@asOf, 'yyyyMMdd'));
    DECLARE @weekStart INT = CONVERT(INT, FORMAT(DATEADD(DAY, -6, @asOf), 'yyyyMMdd'));

    SELECT
        o.Code               AS Code,
        o.Name               AS Name,
        b.Code               AS BrandId,
        ISNULL(SUM(f.NetKwd), 0) / 1000.0 AS AmtKwd,
        CONVERT(DECIMAL(5,2), 10.0) AS YoyPct
    FROM dim.FBOutlet o
    JOIN dim.FBBrand b ON b.FBBrandKey = o.FBBrandKey
    LEFT JOIN fact.FBSales f ON f.FBOutletKey = o.FBOutletKey
                              AND f.DateKey BETWEEN @weekStart AND @asOfKey
    WHERE o.IsActive = 1
      AND (@Brand IS NULL OR b.Code = @Brand)
    GROUP BY o.Code, o.Name, b.Code, o.FBOutletKey
    ORDER BY AmtKwd DESC;
END;
GO

-- ============================================================================
-- Helper: parse scope and return a list of FBOutletKey to filter on (NULL = all)
-- ============================================================================
CREATE OR ALTER FUNCTION app.fn_FBScopeOutlets (
    @ScopeType NVARCHAR(20),
    @ScopeId   NVARCHAR(40)
)
RETURNS TABLE
AS RETURN (
    SELECT o.FBOutletKey
    FROM dim.FBOutlet o
    JOIN dim.FBBrand  b ON b.FBBrandKey = o.FBBrandKey
    WHERE o.IsActive = 1
      AND (@ScopeType = 'all'
        OR (@ScopeType = 'brand'  AND b.Code = @ScopeId)
        OR (@ScopeType = 'outlet' AND o.Code = @ScopeId))
);
GO

-- ============================================================================
-- sp_GetFBSummary
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetFBSummary
    @AsOfDate  DATE,
    @ScopeType NVARCHAR(20) = 'all',
    @ScopeId   NVARCHAR(40) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @asOfKey INT = CONVERT(INT, FORMAT(@AsOfDate, 'yyyyMMdd'));
    DECLARE @weekStart INT = CONVERT(INT, FORMAT(DATEADD(DAY, -6, @AsOfDate), 'yyyyMMdd'));

    DECLARE @scopeName NVARCHAR(200) =
        CASE @ScopeType
             WHEN 'all'    THEN N'All Brands & Outlets'
             WHEN 'brand'  THEN (SELECT Name FROM dim.FBBrand  WHERE Code = @ScopeId)
             WHEN 'outlet' THEN (SELECT o.Code + ' ' + o.Name FROM dim.FBOutlet o WHERE o.Code = @ScopeId)
        END;

    SELECT
        @ScopeType                    AS ScopeType,
        @ScopeId                      AS ScopeId,
        ISNULL(@scopeName, N'Unknown') AS ScopeName,
        ISNULL(SUM(f.NetKwd), 0) / 1000.0 AS RevenueKwd,
        ISNULL(SUM(f.Covers), 0) AS Covers,
        CASE WHEN SUM(f.Transactions) = 0 THEN 0
             ELSE SUM(f.NetKwd) / SUM(f.Transactions) END AS TicketKwd,
        COUNT(DISTINCT f.FBOutletKey) AS OutletsActive,
        (SELECT COUNT(*) FROM app.fn_FBScopeOutlets(@ScopeType, @ScopeId)) AS OutletsTotal,
        CONVERT(DECIMAL(5,2), 14.6)   AS YoyPct           -- TODO: real YoY
    FROM fact.FBSales f
    WHERE f.DateKey BETWEEN @weekStart AND @asOfKey
      AND f.FBOutletKey IN (SELECT FBOutletKey FROM app.fn_FBScopeOutlets(@ScopeType, @ScopeId));
END;
GO

-- ============================================================================
-- sp_GetFBBrandSummary — brand-wise breakdown for the visible scope
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetFBBrandSummary
    @AsOfDate  DATE,
    @ScopeType NVARCHAR(20) = 'all',
    @ScopeId   NVARCHAR(40) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @asOfKey   INT = CONVERT(INT, FORMAT(@AsOfDate, 'yyyyMMdd'));
    DECLARE @weekStart INT = CONVERT(INT, FORMAT(DATEADD(DAY, -6, @AsOfDate), 'yyyyMMdd'));

    SELECT
        b.Code AS Id,
        b.Name AS Name,
        ISNULL(SUM(f.NetKwd), 0) / 1000.0 AS AmtKwd,
        CONVERT(DECIMAL(5,2), 12.0) AS YoyPct,
        ISNULL(b.BrandColor, '#bdc3c7') AS Color,
        0.0 AS DeliveryKwd,
        COUNT(DISTINCT o.FBOutletKey) AS OutletCount
    FROM dim.FBBrand b
    JOIN dim.FBOutlet o  ON o.FBBrandKey = b.FBBrandKey
    LEFT JOIN fact.FBSales f ON f.FBOutletKey = o.FBOutletKey AND f.DateKey BETWEEN @weekStart AND @asOfKey
    WHERE o.FBOutletKey IN (SELECT FBOutletKey FROM app.fn_FBScopeOutlets(@ScopeType, @ScopeId))
    GROUP BY b.FBBrandKey, b.Code, b.Name, b.BrandColor
    ORDER BY AmtKwd DESC;
END;
GO

-- ============================================================================
-- sp_GetFBAggregators
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetFBAggregators
    @AsOfDate  DATE,
    @ScopeType NVARCHAR(20) = 'all',
    @ScopeId   NVARCHAR(40) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @asOfKey   INT = CONVERT(INT, FORMAT(@AsOfDate, 'yyyyMMdd'));
    DECLARE @weekStart INT = CONVERT(INT, FORMAT(DATEADD(DAY, -6, @AsOfDate), 'yyyyMMdd'));

    ;WITH totals AS (
        SELECT SUM(f.NetKwd) AS TotalNet
        FROM fact.FBSales f
        WHERE f.DateKey BETWEEN @weekStart AND @asOfKey
          AND f.FBOutletKey IN (SELECT FBOutletKey FROM app.fn_FBScopeOutlets(@ScopeType, @ScopeId))
    )
    SELECT
        a.Code  AS [Key],
        a.Label AS Label,
        SUM(f.NetKwd) / 1000.0 AS Kwd,
        CASE WHEN totals.TotalNet = 0 THEN 0
             ELSE SUM(f.NetKwd) * 100.0 / totals.TotalNet END AS Pct,
        ISNULL(a.Color, '#bdc3c7') AS Color
    FROM fact.FBSales f
    JOIN ref.Aggregator a ON a.AggregatorKey = f.AggregatorKey
    CROSS JOIN totals
    WHERE f.DateKey BETWEEN @weekStart AND @asOfKey
      AND f.FBOutletKey IN (SELECT FBOutletKey FROM app.fn_FBScopeOutlets(@ScopeType, @ScopeId))
    GROUP BY a.Code, a.Label, a.Color, a.SortOrder, totals.TotalNet
    ORDER BY a.SortOrder, Kwd DESC;
END;
GO

-- ============================================================================
-- sp_GetFBPayments
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetFBPayments
    @AsOfDate  DATE,
    @ScopeType NVARCHAR(20) = 'all',
    @ScopeId   NVARCHAR(40) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @asOfKey   INT = CONVERT(INT, FORMAT(@AsOfDate, 'yyyyMMdd'));
    DECLARE @weekStart INT = CONVERT(INT, FORMAT(DATEADD(DAY, -6, @AsOfDate), 'yyyyMMdd'));

    ;WITH totals AS (
        SELECT SUM(f.NetKwd) AS TotalNet
        FROM fact.FBSales f
        WHERE f.DateKey BETWEEN @weekStart AND @asOfKey
          AND f.FBOutletKey IN (SELECT FBOutletKey FROM app.fn_FBScopeOutlets(@ScopeType, @ScopeId))
    )
    SELECT
        pt.Code   AS [Key],
        pt.Label  AS Label,
        SUM(f.NetKwd) / 1000.0 AS Kwd,
        CASE WHEN totals.TotalNet = 0 THEN 0
             ELSE SUM(f.NetKwd) * 100.0 / totals.TotalNet END AS Pct,
        ISNULL(pt.Color, '#bdc3c7') AS Color
    FROM fact.FBSales f
    JOIN ref.PaymentType pt ON pt.PaymentTypeKey = f.PaymentTypeKey
    CROSS JOIN totals
    WHERE f.DateKey BETWEEN @weekStart AND @asOfKey
      AND f.FBOutletKey IN (SELECT FBOutletKey FROM app.fn_FBScopeOutlets(@ScopeType, @ScopeId))
    GROUP BY pt.Code, pt.Label, pt.Color, pt.SortOrder, totals.TotalNet
    ORDER BY pt.SortOrder, Kwd DESC;
END;
GO

-- ============================================================================
-- sp_GetFBDeliveryByBrand
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetFBDeliveryByBrand
    @AsOfDate  DATE,
    @ScopeType NVARCHAR(20) = 'all',
    @ScopeId   NVARCHAR(40) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @asOfKey   INT = CONVERT(INT, FORMAT(@AsOfDate, 'yyyyMMdd'));
    DECLARE @weekStart INT = CONVERT(INT, FORMAT(DATEADD(DAY, -6, @AsOfDate), 'yyyyMMdd'));

    SELECT
        b.Code AS Id,
        b.Name AS Name,
        ISNULL(SUM(f.NetKwd), 0) / 1000.0 AS AmtKwd,
        CONVERT(DECIMAL(5,2), 12.0) AS YoyPct,
        ISNULL(b.BrandColor, '#bdc3c7') AS Color,
        ISNULL(SUM(CASE WHEN ch.Code = 'delivery' THEN f.NetKwd ELSE 0 END), 0) / 1000.0 AS DeliveryKwd,
        COUNT(DISTINCT o.FBOutletKey) AS OutletCount
    FROM dim.FBBrand b
    JOIN dim.FBOutlet o     ON o.FBBrandKey  = b.FBBrandKey
    LEFT JOIN fact.FBSales f ON f.FBOutletKey = o.FBOutletKey
                              AND f.DateKey BETWEEN @weekStart AND @asOfKey
    LEFT JOIN ref.Channel ch ON ch.ChannelKey = f.ChannelKey
    WHERE o.FBOutletKey IN (SELECT FBOutletKey FROM app.fn_FBScopeOutlets(@ScopeType, @ScopeId))
    GROUP BY b.FBBrandKey, b.Code, b.Name, b.BrandColor
    ORDER BY DeliveryKwd DESC;
END;
GO

-- ============================================================================
-- sp_GetFBTopOutlets
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetFBTopOutlets
    @AsOfDate  DATE,
    @ScopeType NVARCHAR(20) = 'all',
    @ScopeId   NVARCHAR(40) = NULL,
    @Limit     INT = 10
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @asOfKey   INT = CONVERT(INT, FORMAT(@AsOfDate, 'yyyyMMdd'));
    DECLARE @weekStart INT = CONVERT(INT, FORMAT(DATEADD(DAY, -6, @AsOfDate), 'yyyyMMdd'));

    SELECT TOP (@Limit)
        o.Code AS Code,
        o.Name AS Name,
        b.Code AS BrandId,
        ISNULL(SUM(f.NetKwd), 0) / 1000.0 AS AmtKwd,
        CONVERT(DECIMAL(5,2), 12.0) AS YoyPct
    FROM dim.FBOutlet o
    JOIN dim.FBBrand  b ON b.FBBrandKey = o.FBBrandKey
    LEFT JOIN fact.FBSales f ON f.FBOutletKey = o.FBOutletKey AND f.DateKey BETWEEN @weekStart AND @asOfKey
    WHERE o.FBOutletKey IN (SELECT FBOutletKey FROM app.fn_FBScopeOutlets(@ScopeType, @ScopeId))
    GROUP BY o.Code, o.Name, b.Code
    ORDER BY AmtKwd DESC;
END;
GO

PRINT 'F&B stored procedures created.';
