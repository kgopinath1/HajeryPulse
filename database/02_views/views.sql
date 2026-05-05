/* ============================================================================
   Script 020: Views — convenience aggregations used by stored procedures.
   ============================================================================ */
USE HajeryPulse_Reporting;
GO

-- ============================================================================
-- vw_OrgFlat — flattens the org hierarchy with all four levels in one row.
-- Useful for fast filtering when we know we want, say, all rows under HC00.
-- ============================================================================
CREATE OR ALTER VIEW dim.vw_OrgFlat AS
WITH cte AS (
    SELECT
        bu.OrgUnitKey AS BuKey,    bu.Code AS BuCode,    bu.Name AS BuName,
        d.OrgUnitKey  AS DivKey,   d.Code  AS DivCode,   d.Name  AS DivName,
        bt.OrgUnitKey AS BtKey,    bt.Code AS BtCode,    bt.Name AS BtName,
        dpt.OrgUnitKey AS DeptKey, dpt.Code AS DeptCode, dpt.Name AS DeptName
    FROM dim.OrgUnit bu
    LEFT JOIN dim.OrgUnit d   ON d.ParentKey   = bu.OrgUnitKey AND d.[Level]   = 'Division'
    LEFT JOIN dim.OrgUnit bt  ON bt.ParentKey  = d.OrgUnitKey  AND bt.[Level]  = 'BusinessType'
    LEFT JOIN dim.OrgUnit dpt ON dpt.ParentKey = bt.OrgUnitKey AND dpt.[Level] = 'Department'
    WHERE bu.[Level] = 'BusinessUnit' AND bu.IsActive = 1
)
SELECT * FROM cte;
GO

-- ============================================================================
-- vw_WTDailyByOrg — denormalized daily sales by deepest org level.
-- ============================================================================
CREATE OR ALTER VIEW fact.vw_WTDailyByOrg AS
SELECT
    f.DateKey,
    d.[Date],
    f.OrgUnitKey,
    o.Code      AS OrgCode,
    o.[Level]   AS OrgLevel,
    o.BuCode,
    f.Channel,
    SUM(f.GrossKwd)         AS GrossKwd,
    SUM(f.ReturnsKwd)       AS ReturnsKwd,
    SUM(f.CancellationsKwd) AS CancellationsKwd,
    SUM(f.NetKwd)           AS NetKwd,
    SUM(f.CogsKwd)          AS CogsKwd
FROM fact.SalesWT f
JOIN dim.[Date]   d ON d.DateKey  = f.DateKey
JOIN dim.OrgUnit  o ON o.OrgUnitKey = f.OrgUnitKey
GROUP BY f.DateKey, d.[Date], f.OrgUnitKey, o.Code, o.[Level], o.BuCode, f.Channel;
GO

PRINT 'Views created.';
