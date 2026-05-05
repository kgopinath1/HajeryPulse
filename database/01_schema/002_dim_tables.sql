/* ============================================================================
   Script 002: Dimension tables.
   ============================================================================ */
USE HajeryPulse_Reporting;
GO

-- ============================================================================
-- dim.Date — populated 2020-01-01 to 2030-12-31 by the seed script
-- ============================================================================
IF OBJECT_ID(N'dim.Date', N'U') IS NULL
CREATE TABLE dim.Date (
    DateKey         INT          NOT NULL PRIMARY KEY,    -- YYYYMMDD
    [Date]          DATE         NOT NULL UNIQUE,
    [Year]          SMALLINT     NOT NULL,
    [Quarter]       TINYINT      NOT NULL,
    [Month]         TINYINT      NOT NULL,
    MonthName       NVARCHAR(20) NOT NULL,
    [Week]          TINYINT      NOT NULL,
    DayOfWeek       TINYINT      NOT NULL,
    DayName         NVARCHAR(20) NOT NULL,
    IsWeekend       BIT          NOT NULL,
    IsKuwaitHoliday BIT          NOT NULL DEFAULT 0
);
GO

-- ============================================================================
-- dim.OrgUnit — recursive hierarchy: BU > Division > BusinessType > Department
-- ============================================================================
IF OBJECT_ID(N'dim.OrgUnit', N'U') IS NULL
CREATE TABLE dim.OrgUnit (
    OrgUnitKey  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Code        NVARCHAR(20)      NOT NULL UNIQUE,
    Name        NVARCHAR(200)     NOT NULL,
    [Level]     NVARCHAR(40)      NOT NULL,    -- 'BusinessUnit'/'Division'/'BusinessType'/'Department'
    ParentKey   INT               NULL REFERENCES dim.OrgUnit(OrgUnitKey),
    BuCode      NVARCHAR(20)      NULL,        -- denormalized for fast filtering
    IsActive    BIT               NOT NULL DEFAULT 1,
    CreatedAt   DATETIME2(0)      NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_OrgUnit_Parent')
    CREATE INDEX IX_OrgUnit_Parent ON dim.OrgUnit (ParentKey, IsActive) INCLUDE (Code, Name);
GO

-- ============================================================================
-- dim.Customer
-- ============================================================================
IF OBJECT_ID(N'dim.Customer', N'U') IS NULL
CREATE TABLE dim.Customer (
    CustomerKey INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Code        NVARCHAR(40)      NOT NULL UNIQUE,
    Name        NVARCHAR(200)     NOT NULL,
    [Type]      NVARCHAR(40)      NOT NULL,
    Country     NVARCHAR(40)      NULL,
    IsActive    BIT               NOT NULL DEFAULT 1
);
GO

-- ============================================================================
-- dim.Brand — for W&T top-brands
-- ============================================================================
IF OBJECT_ID(N'dim.Brand', N'U') IS NULL
CREATE TABLE dim.Brand (
    BrandKey  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Name      NVARCHAR(200)     NOT NULL UNIQUE,
    Segment   NVARCHAR(80)      NULL,
    IsActive  BIT               NOT NULL DEFAULT 1
);
GO

-- ============================================================================
-- dim.Pharmacy
-- ============================================================================
IF OBJECT_ID(N'dim.Pharmacy', N'U') IS NULL
CREATE TABLE dim.Pharmacy (
    PharmacyKey INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Code        NVARCHAR(20)      NOT NULL UNIQUE,
    [Name]      NVARCHAR(200)     NOT NULL,
    Area        NVARCHAR(80)      NULL,
    OpenedOn    DATE              NULL,
    IsActive    BIT               NOT NULL DEFAULT 1
);
GO

-- ============================================================================
-- dim.FBBrand and dim.FBOutlet
-- ============================================================================
IF OBJECT_ID(N'dim.FBBrand', N'U') IS NULL
CREATE TABLE dim.FBBrand (
    FBBrandKey  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Code        NVARCHAR(20)      NOT NULL UNIQUE,
    Name        NVARCHAR(200)     NOT NULL,
    BrandColor  NVARCHAR(10)      NULL,        -- hex e.g. '#ff7cae'
    IsActive    BIT               NOT NULL DEFAULT 1
);
GO

IF OBJECT_ID(N'dim.FBOutlet', N'U') IS NULL
CREATE TABLE dim.FBOutlet (
    FBOutletKey INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Code        NVARCHAR(20)      NOT NULL UNIQUE,        -- DB70, HD36, EX03, etc.
    Name        NVARCHAR(200)     NOT NULL,
    FBBrandKey  INT               NOT NULL REFERENCES dim.FBBrand(FBBrandKey),
    IsActive    BIT               NOT NULL DEFAULT 1
);
GO

-- ============================================================================
-- ref.* — small, static lookup tables
-- ============================================================================
IF OBJECT_ID(N'ref.PaymentType', N'U') IS NULL
CREATE TABLE ref.PaymentType (
    PaymentTypeKey INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Code           NVARCHAR(40)      NOT NULL UNIQUE,
    Label          NVARCHAR(80)      NOT NULL,
    Color          NVARCHAR(10)      NULL,
    SortOrder      INT               NOT NULL DEFAULT 0
);
GO

IF OBJECT_ID(N'ref.Aggregator', N'U') IS NULL
CREATE TABLE ref.Aggregator (
    AggregatorKey INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Code          NVARCHAR(40)      NOT NULL UNIQUE,
    Label         NVARCHAR(80)      NOT NULL,
    Color         NVARCHAR(10)      NULL,
    SortOrder     INT               NOT NULL DEFAULT 0
);
GO

IF OBJECT_ID(N'ref.Channel', N'U') IS NULL
CREATE TABLE ref.Channel (
    ChannelKey INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Code       NVARCHAR(40)      NOT NULL UNIQUE,        -- 'instore', 'callcenter', 'aggregator', 'dinein', 'delivery', 'takeaway'
    Label      NVARCHAR(80)      NOT NULL
);
GO

IF OBJECT_ID(N'ref.Category', N'U') IS NULL
CREATE TABLE ref.Category (
    CategoryKey INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Code        NVARCHAR(40)      NOT NULL UNIQUE,        -- 'rx', 'otc', 'vits', etc.
    Label       NVARCHAR(80)      NOT NULL,
    IsRx        BIT               NOT NULL DEFAULT 0,
    SortOrder   INT               NOT NULL DEFAULT 0
);
GO

-- ============================================================================
-- dim.User
-- ============================================================================
IF OBJECT_ID(N'dim.[User]', N'U') IS NULL
CREATE TABLE dim.[User] (
    UserKey         INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    EntraObjectId   UNIQUEIDENTIFIER  NOT NULL UNIQUE,
    Email           NVARCHAR(255)     NOT NULL,
    DisplayName     NVARCHAR(200)     NOT NULL,
    Roles           NVARCHAR(MAX)     NOT NULL DEFAULT N'[]',  -- JSON
    ScopedBuCodes   NVARCHAR(MAX)     NOT NULL DEFAULT N'[]',  -- JSON
    LastLoginAt     DATETIME2(0)      NULL,
    IsActive        BIT               NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2(0)      NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

PRINT 'Dimension tables created.';
