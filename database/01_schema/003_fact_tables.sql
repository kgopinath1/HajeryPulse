/* ============================================================================
   Script 003: Fact tables (daily aggregates).
   ============================================================================ */
USE HajeryPulse_Reporting;
GO

-- ============================================================================
-- fact.SalesWT — daily Wholesale + Tender aggregations
-- Grain: (date, org unit, customer, brand, channel)
-- ============================================================================
IF OBJECT_ID(N'fact.SalesWT', N'U') IS NULL
CREATE TABLE fact.SalesWT (
    SalesWTKey         BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    DateKey            INT           NOT NULL REFERENCES dim.Date(DateKey),
    OrgUnitKey         INT           NOT NULL REFERENCES dim.OrgUnit(OrgUnitKey),
    CustomerKey        INT           NULL     REFERENCES dim.Customer(CustomerKey),
    BrandKey           INT           NULL     REFERENCES dim.Brand(BrandKey),
    Channel            CHAR(1)       NOT NULL CHECK (Channel IN ('W','T')),
    GrossKwd           DECIMAL(18,3) NOT NULL DEFAULT 0,
    ReturnsKwd         DECIMAL(18,3) NOT NULL DEFAULT 0,
    CancellationsKwd   DECIMAL(18,3) NOT NULL DEFAULT 0,
    NetKwd             DECIMAL(18,3) NOT NULL DEFAULT 0,
    CogsKwd            DECIMAL(18,3) NOT NULL DEFAULT 0,
    LoadedAt           DATETIME2(0)  NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SalesWT_DateOrg')
    CREATE INDEX IX_SalesWT_DateOrg ON fact.SalesWT (DateKey, OrgUnitKey, Channel)
        INCLUDE (NetKwd, GrossKwd, CogsKwd, ReturnsKwd, CancellationsKwd);
GO

-- ============================================================================
-- fact.PharmacySales — daily pharmacy aggregates
-- Grain: (date, pharmacy, category, channel, payment type)
-- ============================================================================
IF OBJECT_ID(N'fact.PharmacySales', N'U') IS NULL
CREATE TABLE fact.PharmacySales (
    PharmacySalesKey  BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    DateKey           INT           NOT NULL REFERENCES dim.Date(DateKey),
    PharmacyKey       INT           NOT NULL REFERENCES dim.Pharmacy(PharmacyKey),
    CategoryKey       INT           NULL     REFERENCES ref.Category(CategoryKey),
    ChannelKey        INT           NULL     REFERENCES ref.Channel(ChannelKey),
    PaymentTypeKey    INT           NULL     REFERENCES ref.PaymentType(PaymentTypeKey),
    GrossKwd          DECIMAL(18,3) NOT NULL DEFAULT 0,
    DiscountKwd       DECIMAL(18,3) NOT NULL DEFAULT 0,
    ReturnsKwd        DECIMAL(18,3) NOT NULL DEFAULT 0,
    NetKwd            DECIMAL(18,3) NOT NULL DEFAULT 0,
    CogsKwd           DECIMAL(18,3) NOT NULL DEFAULT 0,
    Transactions      INT           NOT NULL DEFAULT 0,
    LoadedAt          DATETIME2(0)  NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PharmacySales_DatePharma')
    CREATE INDEX IX_PharmacySales_DatePharma ON fact.PharmacySales (DateKey, PharmacyKey)
        INCLUDE (NetKwd, GrossKwd, DiscountKwd, ReturnsKwd, CogsKwd, Transactions);
GO

-- ============================================================================
-- fact.FBSales — daily F&B aggregates
-- Grain: (date, outlet, channel, payment type, aggregator)
-- ============================================================================
IF OBJECT_ID(N'fact.FBSales', N'U') IS NULL
CREATE TABLE fact.FBSales (
    FBSalesKey       BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    DateKey          INT           NOT NULL REFERENCES dim.Date(DateKey),
    FBOutletKey      INT           NOT NULL REFERENCES dim.FBOutlet(FBOutletKey),
    ChannelKey       INT           NULL     REFERENCES ref.Channel(ChannelKey),
    PaymentTypeKey   INT           NULL     REFERENCES ref.PaymentType(PaymentTypeKey),
    AggregatorKey    INT           NULL     REFERENCES ref.Aggregator(AggregatorKey),
    GrossKwd         DECIMAL(18,3) NOT NULL DEFAULT 0,
    NetKwd           DECIMAL(18,3) NOT NULL DEFAULT 0,
    Covers           INT           NOT NULL DEFAULT 0,
    Transactions     INT           NOT NULL DEFAULT 0,
    LoadedAt         DATETIME2(0)  NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FBSales_DateOutlet')
    CREATE INDEX IX_FBSales_DateOutlet ON fact.FBSales (DateKey, FBOutletKey)
        INCLUDE (NetKwd, GrossKwd, Covers, Transactions);
GO

-- ============================================================================
-- fact.FinanceSnapshot — point-in-time financial KPIs
-- ============================================================================
IF OBJECT_ID(N'fact.FinanceSnapshot', N'U') IS NULL
CREATE TABLE fact.FinanceSnapshot (
    FinanceSnapshotKey BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    DateKey            INT           NOT NULL UNIQUE REFERENCES dim.Date(DateKey),
    GrossMarginPct     DECIMAL(5,2)  NOT NULL,
    TargetPct          DECIMAL(5,2)  NOT NULL,
    PreviousPct        DECIMAL(5,2)  NOT NULL,
    ArDaysOutstanding  INT           NOT NULL,
    ApDaysOutstanding  INT           NOT NULL,
    WorkingCapitalKwd  DECIMAL(18,3) NOT NULL,
    CashOnHandKwd      DECIMAL(18,3) NOT NULL,
    -- ops
    FillRatePct        DECIMAL(5,2)  NOT NULL,
    SlaCompliancePct   DECIMAL(5,2)  NOT NULL,
    AvgDispatchHours   DECIMAL(5,2)  NOT NULL,
    OpenServiceTickets INT           NOT NULL,
    LoadedAt           DATETIME2(0)  NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

PRINT 'Fact tables created.';
