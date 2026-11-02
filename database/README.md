# Hajery Pulse — Database

SQL Server reporting database for the Pulse mobile app.

## Setup

Run the scripts in numbered order:

```bash
sqlcmd -S localhost -E -i 01_schema/001_create_database.sql
sqlcmd -S localhost -E -i 01_schema/002_dim_tables.sql
sqlcmd -S localhost -E -i 01_schema/003_fact_tables.sql
sqlcmd -S localhost -E -i 01_schema/004_approval_tables.sql
sqlcmd -S localhost -E -i 01_schema/005_audit_log.sql
sqlcmd -S localhost -E -i 01_schema/006_device_activation.sql
sqlcmd -S localhost -E -i 02_views/views.sql
sqlcmd -S localhost -E -i 03_procedures/sp_sales_wt.sql
sqlcmd -S localhost -E -i 03_procedures/sp_pharmacies.sql
sqlcmd -S localhost -E -i 03_procedures/sp_fb.sql
sqlcmd -S localhost -E -i 03_procedures/sp_inbox.sql
sqlcmd -S localhost -E -i 03_procedures/sp_device_activation.sql

# Demo only — DO NOT run in production:
sqlcmd -S localhost -E -i 04_seed/seed_demo_data.sql
```

All scripts are idempotent — safe to re-run during development.

## Layout

```
01_schema/         CREATE TABLE scripts. Numbered execution order.
02_views/          CREATE VIEW scripts.
03_procedures/     CREATE OR ALTER PROCEDURE scripts.
04_seed/           Demo data — never run in production.
```

## ETL — getting real data in

The schema is the *target* for ETL. The actual loading from your source ERP /
POS systems happens via SQL Server Agent jobs that run nightly + hourly. A
recommended approach:

1. **Hourly incremental** — for fact tables, MERGE yesterday + today only.
2. **Nightly full** — rebuild yesterday's facts from scratch (catches late
   transactions).
3. **Weekly Sunday 03:00** — refresh dimensions (new pharmacies, new outlets,
   new customers, new brands).

Implement in SSIS if your data team uses it; T-SQL `MERGE` scripts also work.

## Permissions

The API service principal needs:

- `EXECUTE` on every stored procedure in the `app` schema
- `SELECT` on every fact, dim, and ref table
- `INSERT` (only) on `audit.Event`
- `INSERT, UPDATE` on `app.ApprovalRequest` and `app.ApprovalHistory`
- `SELECT, INSERT, UPDATE` on `app.UserDevice`; `SELECT, UPDATE` on `app.DeviceActivationCode`

A compliance role (separate principal) gets `SELECT` on `audit.Event`.

## Indexing

The current scripts include the most useful read indexes for the dashboards.
After 6 months of production data, run a query-store review and add indexes
where the optimizer is doing scans. Don't pre-index speculatively — wait for
the workload to settle.

## Device activation (IT)

Each user can use Hajery Pulse on **one** activated device. The first time
they sign in on a phone (and after a reinstall, or on a new phone) the app
asks for an activation code. IT generates it in SSMS and sends it to the user
(Teams, email or in person):

```sql
EXEC app.usp_Device_GenerateActivationCode @Email = N'someone@hajery.com';
-- → ActivationCode (e.g. K7QM-4XPD), ExpiresKuwait
```

- A code works **once**, only for that user, and expires after **48 hours**.
- Generating a new code cancels the user's previous unused code.
- 5 wrong attempts lock the code; generate a new one.
- Activating a new phone automatically turns off the user's previous phone.
- If the user isn't in `dim.[User]`, pass their Entra Object ID (and name)
  with their **first** code. They're added to `dim.[User]`, so after that the
  email alone works for every command:
  `EXEC app.usp_Device_GenerateActivationCode @Email = N'...', @UserObjectId = '...', @DisplayName = N'...';`

Other tasks:

```sql
EXEC app.usp_Device_List;                                   -- every active device
EXEC app.usp_Device_List @Email = N'someone@hajery.com';    -- one user's devices and codes
EXEC app.usp_Device_Revoke @Email = N'someone@hajery.com', @Reason = N'Phone lost';
EXEC app.usp_Device_CancelCodes @Email = N'someone@hajery.com';
```

A revoked phone is locked out within a minute. The App Store / Play review
demo account never needs a code. The old `dbo.Devices` table is no longer
used and can be dropped.
