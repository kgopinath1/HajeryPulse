# Data Model

The reporting database is a star schema. Dimensions hold descriptive attributes; facts hold the numeric measures aggregated daily. Every fact carries surrogate keys to its dimensions plus the natural date.

## Schemas

| Schema    | Purpose |
|-----------|---------|
| `dim`     | Dimensions (slowly-changing, type 1) |
| `fact`    | Daily aggregated measures |
| `app`     | Application tables (approvals, attachments) |
| `audit`   | Append-only audit log |
| `ref`     | Static reference (payment types, aggregators, channels) |

## Dimensions

### `dim.Date`
Pre-populated from 2020-01-01 to 2030-12-31.

| Column | Type | Notes |
|--------|------|-------|
| DateKey       | INT PK     | YYYYMMDD |
| Date          | DATE       | |
| Year, Quarter, Month, Week, DayOfWeek | INT | |
| MonthName, DayName | NVARCHAR(20) | |
| IsWeekend     | BIT        | Fri+Sat in Kuwait |
| IsKuwaitHoliday | BIT      | |

### `dim.OrgUnit`
Recursive hierarchy: BU → Division → Business Type → Department.

| Column | Type | Notes |
|--------|------|-------|
| OrgUnitKey | INT PK IDENTITY | |
| Code       | NVARCHAR(20) UNIQUE | HC00, PD100, PA50, etc. |
| Name       | NVARCHAR(200) | |
| Level      | NVARCHAR(40) | 'BusinessUnit' / 'Division' / 'BusinessType' / 'Department' |
| ParentKey  | INT FK → dim.OrgUnit(OrgUnitKey) | NULL for root |
| BuCode     | NVARCHAR(20) | denormalized for fast filtering |
| IsActive   | BIT | |

Index: `IX_OrgUnit_Parent` on (ParentKey, IsActive).

### `dim.Customer`
| Column | Type |
|--------|------|
| CustomerKey | INT PK IDENTITY |
| Code        | NVARCHAR(40) UNIQUE |
| Name        | NVARCHAR(200) |
| Type        | NVARCHAR(40) — 'Government' / 'Pharmacy' / 'Hospital' / 'Hypermarket' / 'B2B' |
| Country     | NVARCHAR(40) |

### `dim.Brand`
For W&T top-brands list (BBraun, Abbott, GSK, Coloplast, Tefal, Coty, etc.).

### `dim.Pharmacy`
| Column | Type |
|--------|------|
| PharmacyKey | INT PK IDENTITY |
| Code        | NVARCHAR(20) UNIQUE — internal pharmacy code |
| Name        | NVARCHAR(200) |
| Area        | NVARCHAR(80) |
| OpenedOn    | DATE |
| IsActive    | BIT |

### `dim.FBBrand`
The 12 F&B brands (Danish Bakery, Haagen Dazs, Espressamente, Solia, Sutis, Khaneen, Damlooj Lounge, Jafra, Mia, Kitchen Park, Delfino, Damlooj Bakery).

### `dim.FBOutlet`
The 43 F&B outlets, FK to FBBrand.

### `ref.PaymentType`, `ref.Aggregator`, `ref.Channel`
Static reference tables seeded once.

### `dim.User`
| Column | Type |
|--------|------|
| UserKey       | INT PK IDENTITY |
| EntraObjectId | UNIQUEIDENTIFIER UNIQUE |
| Email         | NVARCHAR(255) |
| DisplayName   | NVARCHAR(200) |
| Roles         | NVARCHAR(MAX) — JSON array |
| ScopedBuCodes | NVARCHAR(MAX) — JSON array of BU codes user can see |
| LastLoginAt   | DATETIME2 |

## Facts

### `fact.SalesWT`
Daily aggregated wholesale and tender sales, lowest grain = (date, org unit, customer, brand, channel = W or T).

| Column | Type |
|--------|------|
| SalesWTKey   | BIGINT PK IDENTITY |
| DateKey      | INT FK |
| OrgUnitKey   | INT FK |
| CustomerKey  | INT FK |
| BrandKey     | INT FK |
| Channel      | CHAR(1) — 'W' or 'T' |
| GrossKwd, ReturnsKwd, CancellationsKwd, NetKwd, CogsKwd | DECIMAL(18,3) |

Indexes: `IX_SalesWT_DateOrg` on (DateKey, OrgUnitKey, Channel) INCLUDE (NetKwd, GrossKwd).

### `fact.PharmacySales`
Daily aggregated pharmacy sales, grain = (date, pharmacy, category, channel, payment type).

### `fact.FBSales`
Daily aggregated F&B sales, grain = (date, outlet, channel, payment type, aggregator).

## Application tables

### `app.ApprovalRequest`
| Column | Type |
|--------|------|
| RequestId       | NVARCHAR(40) PK — e.g. 'LPO-2026-1042' |
| Type            | NVARCHAR(20) — 'lpo' / 'asset' / 'expense' / 'hr' |
| Title           | NVARCHAR(400) |
| Description     | NVARCHAR(MAX) |
| AmountKwd       | DECIMAL(18,3) |
| RequesterUserKey | INT FK |
| BuCode          | NVARCHAR(20) |
| Status          | NVARCHAR(20) — 'Pending' / 'Approved' / 'Rejected' / 'Clarification' |
| SubmittedAt     | DATETIME2 |
| DecidedAt       | DATETIME2 NULL |
| DeciderUserKey  | INT NULL FK |
| Comment         | NVARCHAR(MAX) NULL |

### `app.ApprovalLineItem`
Line items for LPO requests (item, qty, unit price, vendor).

### `app.ApprovalAttachment`
File metadata; binary held on disk or blob store.

## Audit log

### `audit.Event`
INSERT-only. Permissions: API service principal has INSERT only; SELECT restricted to compliance role.

| Column | Type |
|--------|------|
| EventId        | BIGINT PK IDENTITY |
| OccurredAt     | DATETIME2 DEFAULT SYSUTCDATETIME() |
| UserKey        | INT FK |
| EventType      | NVARCHAR(40) — 'AUTH_LOGIN' / 'APPROVAL_APPROVE' / 'APPROVAL_REJECT' / 'DATA_VIEW' |
| EntityType     | NVARCHAR(40) NULL |
| EntityId       | NVARCHAR(80) NULL |
| BeforeJson     | NVARCHAR(MAX) NULL |
| AfterJson      | NVARCHAR(MAX) NULL |
| ClientIp       | NVARCHAR(45) |
| DeviceInfo     | NVARCHAR(400) |
| TraceId        | NVARCHAR(80) |

## Refresh strategy

Source data lives in the operational ERP (SAP/Oracle/Dynamics — exact system depends on Hajery's stack) and the POS systems for pharmacies and F&B. ETL outline:

1. **15-minute incremental** for `app.*` (approvals — these are written by the API itself, so technically no ETL — they live in the reporting DB directly).
2. **Hourly** for `fact.SalesWT`, `fact.PharmacySales`, `fact.FBSales` — incremental on yesterday + today.
3. **Daily 02:00** full rebuild of yesterday's facts (rebuild lets late-arriving transactions correct the previous day).
4. **Weekly Sunday 03:00** rebuild dimensions (catches new brands, customers, pharmacies, outlets).

ETL implementation: SQL Server Agent jobs running SSIS packages or T-SQL `MERGE` scripts. SSIS preferred if Hajery's data team already uses it.

## Sizing

For Hajery's scale:
- ~200K rows/day across all three fact tables (combined)
- 73M rows/year
- ~10 GB/year of data; SQL Server compression brings this to ~2 GB/year
- Trivial for SQL Server 2019+; no need for partitioning until year 5+

## Migration / change-management

Schema changes live in numbered SQL scripts in `database/01_schema/`. New columns are nullable with defaults; never `DROP COLUMN` in v1 (rename via deprecation comment). All scripts are idempotent — safe to re-run.
