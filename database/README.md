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
sqlcmd -S localhost -E -i 02_views/views.sql
sqlcmd -S localhost -E -i 03_procedures/sp_sales_wt.sql
sqlcmd -S localhost -E -i 03_procedures/sp_pharmacies.sql
sqlcmd -S localhost -E -i 03_procedures/sp_fb.sql
sqlcmd -S localhost -E -i 03_procedures/sp_inbox.sql

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

A compliance role (separate principal) gets `SELECT` on `audit.Event`.

## Indexing

The current scripts include the most useful read indexes for the dashboards.
After 6 months of production data, run a query-store review and add indexes
where the optimizer is doing scans. Don't pre-index speculatively — wait for
the workload to settle.
