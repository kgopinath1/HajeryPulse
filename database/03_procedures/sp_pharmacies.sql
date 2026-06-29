/* ============================================================================
   Script 031: Pharmacy stored procedures.
   ============================================================================ */
USE HajeryPulse_Reporting;
GO

-- ============================================================================
-- sp_GetPharmacyList — used to populate the picker
-- @PharmacyId = 'all' is synthesized from the rolled-up totals.
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetPharmacyList
    @AsOfDate DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @asOf DATE = ISNULL(@AsOfDate, DATEADD(DAY, -1, CAST(SYSUTCDATETIME() AS DATE)));
    DECLARE @asOfKey INT = CONVERT(INT, FORMAT(@asOf, 'yyyyMMdd'));
    DECLARE @weekStart INT = CONVERT(INT, FORMAT(DATEADD(DAY, -6, @asOf), 'yyyyMMdd'));

    -- Synthetic 'all' row first
    SELECT 'all' AS Id, N'All Pharmacies' AS Name,
           ISNULL((SELECT SUM(NetKwd) FROM fact.PharmacySales WHERE DateKey BETWEEN @weekStart AND @asOfKey), 0) / 1000.0 AS AmtKwd
    UNION ALL
    SELECT
        p.Code AS Id,
        p.Name,
        ISNULL(SUM(f.NetKwd), 0) / 1000.0 AS AmtKwd
    FROM dim.Pharmacy p
    LEFT JOIN fact.PharmacySales f
        ON f.PharmacyKey = p.PharmacyKey
       AND f.DateKey BETWEEN @weekStart AND @asOfKey
    WHERE p.IsActive = 1
    GROUP BY p.Code, p.Name
    ORDER BY AmtKwd DESC;
END;
GO

-- ============================================================================
-- Helper: get PharmacyKey from id ('all' or pharmacy code)
-- ============================================================================
CREATE OR ALTER FUNCTION app.fn_PharmacyKey (@PharmacyId NVARCHAR(20))
RETURNS INT
AS BEGIN
    IF @PharmacyId = 'all' OR @PharmacyId IS NULL RETURN NULL;
    RETURN (SELECT PharmacyKey FROM dim.Pharmacy WHERE Code = @PharmacyId);
END;
GO

-- ============================================================================
-- sp_GetPharmacySummary
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetPharmacySummary
    @AsOfDate   DATE,
    @PharmacyId NVARCHAR(20) = 'all',
    @Period NVARCHAR(20) = 'week'
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @asOfKey INT = CONVERT(INT, FORMAT(@AsOfDate, 'yyyyMMdd'));
    DECLARE @startDate DATE =
        CASE LOWER(ISNULL(@Period, 'week'))
            WHEN 'month'   THEN DATEADD(MONTH, -1, @AsOfDate)
            WHEN 'quarter' THEN DATEADD(MONTH, -3, @AsOfDate)
            WHEN 'ytd'     THEN DATEFROMPARTS(YEAR(@AsOfDate), 1, 1)
            WHEN 'year'    THEN DATEADD(YEAR, -1, @AsOfDate)
            ELSE DATEADD(DAY, -6, @AsOfDate)
        END;
    DECLARE @startKey INT = CONVERT(INT, FORMAT(@startDate, 'yyyyMMdd'));
    DECLARE @phKey INT = app.fn_PharmacyKey(@PharmacyId);

    ;WITH agg AS (
        SELECT
            ISNULL(SUM(NetKwd), 0) AS Net,
            ISNULL(SUM(Transactions), 0) AS Txns,
            COUNT(DISTINCT PharmacyKey) AS DistinctPharmacies
        FROM fact.PharmacySales f
        WHERE f.DateKey BETWEEN @startKey AND @asOfKey
          AND (@phKey IS NULL OR f.PharmacyKey = @phKey)
    ),
    rxAgg AS (
        SELECT ISNULL(SUM(CASE WHEN c.IsRx = 1 THEN f.NetKwd ELSE 0 END), 0) AS RxNet,
               ISNULL(SUM(f.NetKwd), 0) AS TotalNet
        FROM fact.PharmacySales f
        LEFT JOIN ref.Category c ON c.CategoryKey = f.CategoryKey
        WHERE f.DateKey BETWEEN @startKey AND @asOfKey
          AND (@phKey IS NULL OR f.PharmacyKey = @phKey)
    )
    SELECT
        @PharmacyId AS Id,
        CASE WHEN @PharmacyId = 'all' THEN N'All Pharmacies'
             ELSE (SELECT Name FROM dim.Pharmacy WHERE Code = @PharmacyId) END AS Name,
        agg.Net / 1000.0 AS AmtKwd,
        agg.Net / 1000.0 AS RevenueKwd,
        ISNULL(agg.Txns, 0) AS Transactions,
        CASE WHEN agg.Txns = 0 THEN 0 ELSE agg.Net / agg.Txns END AS BasketSizeKwd,
        CASE WHEN @PharmacyId = 'all' THEN agg.DistinctPharmacies ELSE 1 END AS StoresActive,
        CASE WHEN @PharmacyId = 'all'
             THEN (SELECT COUNT(*) FROM dim.Pharmacy WHERE IsActive = 1)
             ELSE 1 END AS StoresTotal,
        CASE WHEN rxAgg.TotalNet = 0 THEN 41
             ELSE rxAgg.RxNet * 100.0 / rxAgg.TotalNet END AS RxSharePct
    FROM agg, rxAgg;
END;
GO

-- ============================================================================
-- sp_GetPharmacyMargin
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetPharmacyMargin
    @AsOfDate   DATE,
    @PharmacyId NVARCHAR(20) = 'all'
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @asOfKey INT = CONVERT(INT, FORMAT(@AsOfDate, 'yyyyMMdd'));
    DECLARE @weekStart INT = CONVERT(INT, FORMAT(DATEADD(DAY, -6, @AsOfDate), 'yyyyMMdd'));
    DECLARE @phKey INT = app.fn_PharmacyKey(@PharmacyId);

    SELECT
        SUM(GrossKwd)    / 1000.0 AS GrossKwd,
        SUM(DiscountKwd) / 1000.0 AS DiscountKwd,
        SUM(CogsKwd)     / 1000.0 AS CogsKwd,
        (SUM(NetKwd) - SUM(CogsKwd)) / 1000.0 AS MarginKwd,
        SUM(NetKwd)      / 1000.0 AS NetSalesKwd,
        CASE WHEN SUM(NetKwd) = 0 THEN 0
             ELSE (SUM(NetKwd) - SUM(CogsKwd)) * 100.0 / SUM(NetKwd) END AS MarginPct,
        CONVERT(DECIMAL(5,2), 40.4) AS MarginPctLY    -- TODO: compute from prior year
    FROM fact.PharmacySales
    WHERE DateKey BETWEEN @weekStart AND @asOfKey
      AND (@phKey IS NULL OR PharmacyKey = @phKey);
END;
GO

-- ============================================================================
-- sp_GetPharmacyQuality
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetPharmacyQuality
    @AsOfDate   DATE,
    @PharmacyId NVARCHAR(20) = 'all'
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @asOfKey INT = CONVERT(INT, FORMAT(@AsOfDate, 'yyyyMMdd'));
    DECLARE @weekStart INT = CONVERT(INT, FORMAT(DATEADD(DAY, -6, @AsOfDate), 'yyyyMMdd'));
    DECLARE @phKey INT = app.fn_PharmacyKey(@PharmacyId);

    ;WITH agg AS (
        SELECT
            SUM(GrossKwd)   AS Gross,
            SUM(ReturnsKwd) AS Returns,
            SUM(NetKwd)     AS Net
        FROM fact.PharmacySales
        WHERE DateKey BETWEEN @weekStart AND @asOfKey
          AND (@phKey IS NULL OR PharmacyKey = @phKey)
    )
    SELECT
        Gross   / 1000.0 AS GrossKwd,
        Returns / 1000.0 AS ReturnsKwd,
        CONVERT(DECIMAL(18,3), 0) AS CancellationsKwd,
        Net     / 1000.0 AS NetKwd,
        CASE WHEN Gross = 0 THEN 0 ELSE Net     * 100.0 / Gross END AS NetPct,
        CASE WHEN Gross = 0 THEN 0 ELSE Returns * 100.0 / Gross END AS ReturnsPct,
        CONVERT(DECIMAL(5,2), 0) AS CancellationsPct
    FROM agg;
END;
GO

-- ============================================================================
-- sp_GetPharmacyChannels
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetPharmacyChannels
    @AsOfDate   DATE,
    @PharmacyId NVARCHAR(20) = 'all'
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @asOfKey INT = CONVERT(INT, FORMAT(@AsOfDate, 'yyyyMMdd'));
    DECLARE @weekStart INT = CONVERT(INT, FORMAT(DATEADD(DAY, -6, @AsOfDate), 'yyyyMMdd'));
    DECLARE @phKey INT = app.fn_PharmacyKey(@PharmacyId);

    SELECT
        ISNULL(SUM(CASE WHEN ch.Code = 'instore'    THEN f.NetKwd ELSE 0 END), 0) / 1000.0 AS InstoreKwd,
        ISNULL(SUM(CASE WHEN ch.Code = 'callcenter' THEN f.NetKwd ELSE 0 END), 0) / 1000.0 AS CallcenterKwd,
        ISNULL(SUM(CASE WHEN ch.Code = 'aggregator' THEN f.NetKwd ELSE 0 END), 0) / 1000.0 AS AggregatorKwd
    FROM fact.PharmacySales f
    LEFT JOIN ref.Channel ch ON ch.ChannelKey = f.ChannelKey
    WHERE f.DateKey BETWEEN @weekStart AND @asOfKey
      AND (@phKey IS NULL OR f.PharmacyKey = @phKey);
END;
GO

-- ============================================================================
-- sp_GetPharmacyPayments
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetPharmacyPayments
    @AsOfDate   DATE,
    @PharmacyId NVARCHAR(20) = 'all'
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @asOfKey INT = CONVERT(INT, FORMAT(@AsOfDate, 'yyyyMMdd'));
    DECLARE @weekStart INT = CONVERT(INT, FORMAT(DATEADD(DAY, -6, @AsOfDate), 'yyyyMMdd'));
    DECLARE @phKey INT = app.fn_PharmacyKey(@PharmacyId);

    ;WITH totals AS (
        SELECT SUM(NetKwd) AS TotalNet
        FROM fact.PharmacySales
        WHERE DateKey BETWEEN @weekStart AND @asOfKey
          AND (@phKey IS NULL OR PharmacyKey = @phKey)
    )
    SELECT
        pt.Code   AS [Key],
        pt.Label  AS Label,
        SUM(f.NetKwd) / 1000.0 AS Kwd,
        CASE WHEN totals.TotalNet = 0 THEN 0
             ELSE SUM(f.NetKwd) * 100.0 / totals.TotalNet END AS Pct,
        ISNULL(pt.Color, '#bdc3c7') AS Color
    FROM fact.PharmacySales f
    JOIN ref.PaymentType pt ON pt.PaymentTypeKey = f.PaymentTypeKey
    CROSS JOIN totals
    WHERE f.DateKey BETWEEN @weekStart AND @asOfKey
      AND (@phKey IS NULL OR f.PharmacyKey = @phKey)
    GROUP BY pt.Code, pt.Label, pt.Color, pt.SortOrder, totals.TotalNet
    ORDER BY pt.SortOrder, Kwd DESC;
END;
GO

-- ============================================================================
-- sp_GetPharmacyCategories
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetPharmacyCategories
    @AsOfDate   DATE,
    @PharmacyId NVARCHAR(20) = 'all',
    @Limit      INT = 10
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @asOfKey INT = CONVERT(INT, FORMAT(@AsOfDate, 'yyyyMMdd'));
    DECLARE @weekStart INT = CONVERT(INT, FORMAT(DATEADD(DAY, -6, @AsOfDate), 'yyyyMMdd'));
    DECLARE @phKey INT = app.fn_PharmacyKey(@PharmacyId);

    ;WITH totals AS (
        SELECT SUM(NetKwd) AS TotalNet
        FROM fact.PharmacySales
        WHERE DateKey BETWEEN @weekStart AND @asOfKey
          AND (@phKey IS NULL OR PharmacyKey = @phKey)
    )
    SELECT TOP (@Limit)
        c.Code  AS [Key],
        c.Label AS Label,
        SUM(f.NetKwd) / 1000.0 AS Kwd,
        CASE WHEN totals.TotalNet = 0 THEN 0 ELSE SUM(f.NetKwd) * 100.0 / totals.TotalNet END AS Pct
    FROM fact.PharmacySales f
    JOIN ref.Category c ON c.CategoryKey = f.CategoryKey
    CROSS JOIN totals
    WHERE f.DateKey BETWEEN @weekStart AND @asOfKey
      AND (@phKey IS NULL OR f.PharmacyKey = @phKey)
    GROUP BY c.Code, c.Label, totals.TotalNet
    ORDER BY Kwd DESC;
END;
GO

-- ============================================================================
-- sp_GetPharmacyRxOtcMix
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetPharmacyRxOtcMix
    @AsOfDate   DATE,
    @PharmacyId NVARCHAR(20) = 'all'
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @asOfKey INT = CONVERT(INT, FORMAT(@AsOfDate, 'yyyyMMdd'));
    DECLARE @weekStart INT = CONVERT(INT, FORMAT(DATEADD(DAY, -6, @AsOfDate), 'yyyyMMdd'));
    DECLARE @phKey INT = app.fn_PharmacyKey(@PharmacyId);

    ;WITH agg AS (
        SELECT
            SUM(CASE WHEN c.IsRx = 1 THEN f.NetKwd ELSE 0 END) AS RxNet,
            SUM(CASE WHEN c.IsRx = 0 THEN f.NetKwd ELSE 0 END) AS OtcNet
        FROM fact.PharmacySales f
        LEFT JOIN ref.Category c ON c.CategoryKey = f.CategoryKey
        WHERE f.DateKey BETWEEN @weekStart AND @asOfKey
          AND (@phKey IS NULL OR f.PharmacyKey = @phKey)
    )
    SELECT
        CASE WHEN (RxNet + OtcNet) = 0 THEN 41
             ELSE RxNet  * 100.0 / NULLIF(RxNet + OtcNet, 0) END AS RxPct,
        CASE WHEN (RxNet + OtcNet) = 0 THEN 59
             ELSE OtcNet * 100.0 / NULLIF(RxNet + OtcNet, 0) END AS OtcPct,
        RxNet  / 1000.0 AS RxKwd,
        OtcNet / 1000.0 AS OtcKwd,
        CONVERT(DECIMAL(5,2), 0.6) AS RxYoyPp    -- TODO: compute from prior year
    FROM agg;
END;
GO

-- ============================================================================
-- sp_GetPharmacyDiscountLeaderboard
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetPharmacyDiscountLeaderboard
    @AsOfDate DATE,
    @Limit    INT = 10
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @asOfKey INT = CONVERT(INT, FORMAT(@AsOfDate, 'yyyyMMdd'));
    DECLARE @weekStart INT = CONVERT(INT, FORMAT(DATEADD(DAY, -6, @AsOfDate), 'yyyyMMdd'));

    SELECT TOP (@Limit)
        p.Code AS Id,
        p.Name AS Name,
        CASE WHEN SUM(f.GrossKwd) = 0 THEN 0
             ELSE SUM(f.DiscountKwd) * 100.0 / SUM(f.GrossKwd) END AS RatePct,
        SUM(f.DiscountKwd) AS DiscountKwd
    FROM dim.Pharmacy p
    JOIN fact.PharmacySales f ON f.PharmacyKey = p.PharmacyKey
    WHERE f.DateKey BETWEEN @weekStart AND @asOfKey
      AND p.IsActive = 1
    GROUP BY p.Code, p.Name
    ORDER BY RatePct DESC;
END;
GO

-- ============================================================================
-- sp_GetTopPharmacies
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetTopPharmacies
    @AsOfDate DATE,
    @Limit    INT = 10
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @asOfKey INT = CONVERT(INT, FORMAT(@AsOfDate, 'yyyyMMdd'));
    DECLARE @weekStart INT = CONVERT(INT, FORMAT(DATEADD(DAY, -6, @AsOfDate), 'yyyyMMdd'));

    SELECT TOP (@Limit)
        p.Code AS Id,
        p.Name AS Name,
        SUM(f.NetKwd) / 1000.0 AS AmtKwd
    FROM dim.Pharmacy p
    JOIN fact.PharmacySales f ON f.PharmacyKey = p.PharmacyKey
    WHERE f.DateKey BETWEEN @weekStart AND @asOfKey
      AND p.IsActive = 1
    GROUP BY p.Code, p.Name
    ORDER BY AmtKwd DESC;
END;
GO

PRINT 'Pharmacy stored procedures created.';
