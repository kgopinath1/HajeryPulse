/* ============================================================================
   Script 030: Wholesale & Tender stored procedures.
   ============================================================================ */
USE HajeryPulse_Reporting;
GO

-- ============================================================================
-- sp_GetWTSummary
-- Returns: 1) summary row, 2) sparkline values (last 8 days)
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetWTSummary
    @AsOfDate DATE,
    @Bt       NVARCHAR(20) = 'both'
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @asOfKey INT = CONVERT(INT, FORMAT(@AsOfDate, 'yyyyMMdd'));
    DECLARE @weekStart INT = CONVERT(INT, FORMAT(DATEADD(DAY, -6, @AsOfDate), 'yyyyMMdd'));
    DECLARE @priorWeekStart INT = CONVERT(INT, FORMAT(DATEADD(DAY, -13, @AsOfDate), 'yyyyMMdd'));
    DECLARE @priorWeekEnd   INT = CONVERT(INT, FORMAT(DATEADD(DAY, -7, @AsOfDate), 'yyyyMMdd'));

    -- Resultset 1: summary row
    ;WITH cur AS (
        SELECT SUM(NetKwd) AS NetKwd
        FROM fact.SalesWT
        WHERE DateKey BETWEEN @weekStart AND @asOfKey
          AND (@Bt = 'both' OR (@Bt = 'wholesale' AND Channel = 'W') OR (@Bt = 'tender' AND Channel = 'T'))
    ),
    prior AS (
        SELECT SUM(NetKwd) AS NetKwd
        FROM fact.SalesWT
        WHERE DateKey BETWEEN @priorWeekStart AND @priorWeekEnd
          AND (@Bt = 'both' OR (@Bt = 'wholesale' AND Channel = 'W') OR (@Bt = 'tender' AND Channel = 'T'))
    )
    SELECT
        ISNULL(cur.NetKwd, 0) / 1000.0  AS RevenueKwd,           -- thousands
        CASE WHEN ISNULL(prior.NetKwd, 0) = 0 THEN 0
             ELSE ((ISNULL(cur.NetKwd, 0) - ISNULL(prior.NetKwd, 0)) * 100.0 / prior.NetKwd) END
                                          AS WowPct,
        CONVERT(INT, 142)              AS NewOrders,            -- TODO: from order table
        CONVERT(DECIMAL(18,3), 2840)   AS OpenOrderValueKwd,    -- TODO: from order table
        CONVERT(INT, 18)               AS ActiveTenders,        -- TODO: from tender table
        CONVERT(DECIMAL(18,3), 234)    AS AvgTenderValueKwd     -- TODO: from tender table
    FROM cur, prior;

    -- Resultset 2: sparkline (last 8 days)
    SELECT TOP (8)
        ISNULL(SUM(NetKwd), 0) / 1000.0 AS Value
    FROM fact.SalesWT
    WHERE DateKey BETWEEN CONVERT(INT, FORMAT(DATEADD(DAY, -7, @AsOfDate), 'yyyyMMdd')) AND @asOfKey
      AND (@Bt = 'both' OR (@Bt = 'wholesale' AND Channel = 'W') OR (@Bt = 'tender' AND Channel = 'T'))
    GROUP BY DateKey
    ORDER BY DateKey;
END;
GO

-- ============================================================================
-- sp_GetWTMargin
-- Returns: 1) summary, 2) 12-month trend cur, 3) 12-month trend LY
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetWTMargin
    @AsOfDate DATE,
    @Bt       NVARCHAR(20) = 'both'
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @asOfKey INT = CONVERT(INT, FORMAT(@AsOfDate, 'yyyyMMdd'));
    DECLARE @yearStart INT = CONVERT(INT, FORMAT(DATEADD(YEAR, -1, @AsOfDate), 'yyyyMMdd'));

    -- Summary
    ;WITH cur AS (
        SELECT SUM(NetKwd) AS Net, SUM(CogsKwd) AS Cogs, SUM(NetKwd - CogsKwd) AS Margin
        FROM fact.SalesWT
        WHERE DateKey BETWEEN @yearStart AND @asOfKey
          AND (@Bt = 'both' OR (@Bt = 'wholesale' AND Channel = 'W') OR (@Bt = 'tender' AND Channel = 'T'))
    )
    SELECT
        CASE WHEN cur.Net = 0 THEN 0 ELSE cur.Margin * 100.0 / cur.Net END AS MarginPct,
        CONVERT(DECIMAL(5,2), 33.7)        AS MarginPctLY,    -- TODO: compute from prior year
        CONVERT(DECIMAL(5,2), 1.2)         AS MarginYoyPp,
        cur.Net    / 1000.0                AS NetSalesKwd,
        cur.Cogs   / 1000.0                AS CogsKwd,
        cur.Margin / 1000.0                AS GrossMarginKwd
    FROM cur;

    -- 12-month trend (current year)
    SELECT TOP (12)
        d.[Year] * 100 + d.[Month] AS YearMonth,
        CASE WHEN SUM(NetKwd) = 0 THEN 0 ELSE SUM(NetKwd - CogsKwd) * 100.0 / SUM(NetKwd) END AS MarginPct
    FROM fact.SalesWT f
    JOIN dim.[Date] d ON d.DateKey = f.DateKey
    WHERE d.[Date] BETWEEN DATEADD(MONTH, -11, @AsOfDate) AND @AsOfDate
      AND (@Bt = 'both' OR (@Bt = 'wholesale' AND Channel = 'W') OR (@Bt = 'tender' AND Channel = 'T'))
    GROUP BY d.[Year], d.[Month]
    ORDER BY YearMonth;

    -- 12-month trend (prior year, same months)
    SELECT TOP (12)
        d.[Year] * 100 + d.[Month] AS YearMonth,
        CASE WHEN SUM(NetKwd) = 0 THEN 0 ELSE SUM(NetKwd - CogsKwd) * 100.0 / SUM(NetKwd) END AS MarginPct
    FROM fact.SalesWT f
    JOIN dim.[Date] d ON d.DateKey = f.DateKey
    WHERE d.[Date] BETWEEN DATEADD(MONTH, -23, @AsOfDate) AND DATEADD(MONTH, -12, @AsOfDate)
      AND (@Bt = 'both' OR (@Bt = 'wholesale' AND Channel = 'W') OR (@Bt = 'tender' AND Channel = 'T'))
    GROUP BY d.[Year], d.[Month]
    ORDER BY YearMonth;
END;
GO

-- ============================================================================
-- sp_GetWTSalesQuality
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetWTSalesQuality
    @AsOfDate DATE,
    @Bt       NVARCHAR(20) = 'both'
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @asOfKey INT = CONVERT(INT, FORMAT(@AsOfDate, 'yyyyMMdd'));
    DECLARE @weekStart INT = CONVERT(INT, FORMAT(DATEADD(DAY, -6, @AsOfDate), 'yyyyMMdd'));

    ;WITH agg AS (
        SELECT
            SUM(GrossKwd)         AS Gross,
            SUM(ReturnsKwd)       AS Returns,
            SUM(CancellationsKwd) AS Cancellations,
            SUM(NetKwd)           AS Net
        FROM fact.SalesWT
        WHERE DateKey BETWEEN @weekStart AND @asOfKey
          AND (@Bt = 'both' OR (@Bt = 'wholesale' AND Channel = 'W') OR (@Bt = 'tender' AND Channel = 'T'))
    )
    SELECT
        Gross         / 1000.0 AS GrossKwd,
        Returns       / 1000.0 AS ReturnsKwd,
        Cancellations / 1000.0 AS CancellationsKwd,
        Net           / 1000.0 AS NetKwd,
        CASE WHEN Gross = 0 THEN 0 ELSE Net           * 100.0 / Gross END AS NetPct,
        CASE WHEN Gross = 0 THEN 0 ELSE Returns       * 100.0 / Gross END AS ReturnsPct,
        CASE WHEN Gross = 0 THEN 0 ELSE Cancellations * 100.0 / Gross END AS CancellationsPct
    FROM agg;
END;
GO

-- ============================================================================
-- sp_GetOrgHierarchy
-- @Parent = 'root' returns BUs; @Parent = 'HC00' returns its divisions; etc.
-- Returns: 1) parent meta, 2) children with W/T amounts.
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetOrgHierarchy
    @AsOfDate DATE,
    @Bt       NVARCHAR(20) = 'both',
    @Parent   NVARCHAR(20) = 'root'
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @asOfKey INT = CONVERT(INT, FORMAT(@AsOfDate, 'yyyyMMdd'));
    DECLARE @weekStart INT = CONVERT(INT, FORMAT(DATEADD(DAY, -6, @AsOfDate), 'yyyyMMdd'));
    DECLARE @parentKey INT;
    DECLARE @parentLevel NVARCHAR(40);
    DECLARE @parentLabel NVARCHAR(200);

    IF @Parent = 'root'
    BEGIN
        SET @parentKey = NULL;  -- top level
        SET @parentLevel = 'BusinessUnit';
        SET @parentLabel = 'Hajery Group';
    END
    ELSE
    BEGIN
        SELECT @parentKey = OrgUnitKey, @parentLevel = [Level] + N'-children', @parentLabel = Name
        FROM dim.OrgUnit WHERE Code = @Parent;
    END

    -- Resultset 1: parent meta
    SELECT @parentLevel AS [Level], @parentLabel AS Label;

    -- Resultset 2: children with current-week amounts (split by channel)
    SELECT
        c.Code               AS [Key],
        c.Code               AS Code,
        c.Name               AS Name,
        ISNULL(SUM(CASE WHEN f.Channel = 'W' THEN f.NetKwd ELSE 0 END), 0) / 1000.0 AS AmtW,
        ISNULL(SUM(CASE WHEN f.Channel = 'T' THEN f.NetKwd ELSE 0 END), 0) / 1000.0 AS AmtT,
        CONVERT(DECIMAL(5,2), 12.4) AS Yoy,    -- TODO: real YoY
        CASE WHEN EXISTS (SELECT 1 FROM dim.OrgUnit gc WHERE gc.ParentKey = c.OrgUnitKey AND gc.IsActive = 1) THEN 1 ELSE 0 END AS HasChildren
    FROM dim.OrgUnit c
    LEFT JOIN fact.SalesWT f
           ON f.OrgUnitKey IN (
               -- the org sub-tree under c (DFS — for big trees, replace with a recursive CTE or a closure table)
               SELECT OrgUnitKey FROM dim.OrgUnit WHERE OrgUnitKey = c.OrgUnitKey
               UNION ALL
               SELECT g.OrgUnitKey FROM dim.OrgUnit g WHERE g.ParentKey = c.OrgUnitKey
           )
          AND f.DateKey BETWEEN @weekStart AND @asOfKey
    WHERE c.IsActive = 1
      AND ( (@Parent = 'root' AND c.[Level] = 'BusinessUnit')
         OR (c.ParentKey = @parentKey) )
    GROUP BY c.OrgUnitKey, c.Code, c.Name
    ORDER BY (ISNULL(SUM(CASE WHEN f.Channel = 'W' THEN f.NetKwd ELSE 0 END), 0)
             + ISNULL(SUM(CASE WHEN f.Channel = 'T' THEN f.NetKwd ELSE 0 END), 0)) DESC;
END;
GO

-- ============================================================================
-- sp_GetTopBrands
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetTopBrands
    @AsOfDate DATE,
    @Bt       NVARCHAR(20) = 'both',
    @Limit    INT = 10
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @asOfKey INT = CONVERT(INT, FORMAT(@AsOfDate, 'yyyyMMdd'));
    DECLARE @weekStart INT = CONVERT(INT, FORMAT(DATEADD(DAY, -6, @AsOfDate), 'yyyyMMdd'));

    SELECT TOP (@Limit)
        ROW_NUMBER() OVER (ORDER BY SUM(f.NetKwd) DESC) AS Rank,
        b.Name      AS Brand,
        b.Segment   AS Segment,
        SUM(f.NetKwd) / 1000.0 AS AmountKwd,
        CONVERT(DECIMAL(5,2), 12.0)  AS YoyPct       -- TODO: compute from prior year
    FROM fact.SalesWT f
    JOIN dim.Brand    b ON b.BrandKey = f.BrandKey
    WHERE f.DateKey BETWEEN @weekStart AND @asOfKey
      AND (@Bt = 'both' OR (@Bt = 'wholesale' AND f.Channel = 'W') OR (@Bt = 'tender' AND f.Channel = 'T'))
      AND b.IsActive = 1
    GROUP BY b.BrandKey, b.Name, b.Segment
    ORDER BY AmountKwd DESC;
END;
GO

-- ============================================================================
-- sp_GetTopCustomers
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetTopCustomers
    @AsOfDate DATE,
    @Bt       NVARCHAR(20) = 'both',
    @Limit    INT = 10
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @asOfKey INT = CONVERT(INT, FORMAT(@AsOfDate, 'yyyyMMdd'));
    DECLARE @weekStart INT = CONVERT(INT, FORMAT(DATEADD(DAY, -6, @AsOfDate), 'yyyyMMdd'));

    SELECT TOP (@Limit)
        ROW_NUMBER() OVER (ORDER BY SUM(f.NetKwd) DESC) AS Rank,
        c.Name              AS Customer,
        c.[Type]            AS [Type],
        COUNT(DISTINCT f.DateKey) AS OrdersThisWeek,
        SUM(f.NetKwd) / 1000.0    AS AmountKwd,
        CONVERT(DECIMAL(5,2), 14.0) AS YoyPct
    FROM fact.SalesWT f
    JOIN dim.Customer c ON c.CustomerKey = f.CustomerKey
    WHERE f.DateKey BETWEEN @weekStart AND @asOfKey
      AND (@Bt = 'both' OR (@Bt = 'wholesale' AND f.Channel = 'W') OR (@Bt = 'tender' AND f.Channel = 'T'))
      AND c.IsActive = 1
    GROUP BY c.CustomerKey, c.Name, c.[Type]
    ORDER BY AmountKwd DESC;
END;
GO

PRINT 'W&T stored procedures created.';
