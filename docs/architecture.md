# Architecture

## Goals

- Sub-second dashboard loads for executives anywhere in the world
- Zero impact on the operational ERP/POS systems
- Auditable approval flow for LPOs and asset-purchase requests
- Single mobile codebase serving iOS + Android, ~50 named users at peak
- Hosted entirely in the Hajery Group data center; no third-party SaaS handling business data

## Components

### 1. Mobile client (React Native + TypeScript)

- One codebase, two platforms (iOS 15+, Android 10+)
- Native UI via React Native primitives; charts via react-native-svg
- Local secure storage for refresh tokens (Keychain/Keystore via `react-native-keychain`)
- Biometric gate via `react-native-biometrics`
- Offline cache of last-loaded dashboards (read-only) so the app opens instantly on cold start
- All money formatting in KWD, locale-aware

### 2. API (ASP.NET Core 8)

- Stateless REST service, two instances behind a load balancer for redundancy
- JWT bearer auth via Microsoft.Identity.Web (Entra ID validated locally — no per-request call to Azure)
- Dapper for SQL Server access (faster than EF Core for read-heavy reporting)
- StackExchange.Redis for cache
- Serilog → file + Application Insights
- Swagger/OpenAPI exposed only on internal interface (not public)

### 3. Reporting database (SQL Server)

- Separate database from the operational ERP, refreshed by SQL Server Agent jobs every 15–60 minutes
- Star schema: dimensions (date, org unit, customer, brand, pharmacy, F&B brand/outlet, payment, aggregator) + facts (sales, pharmacy sales, F&B sales, approvals)
- Append-only audit log table — separate schema with INSERT-only permissions

### 4. Cache (Redis)

- 5–15 min TTL for dashboard endpoints
- 30 sec TTL for inbox endpoints
- Cache key includes user role, BU scope, as-on-date, and any active filter so different scopes don't collide

## Data flow — typical dashboard load

```
1. User taps "Wholesale & Tender" tab
2. Mobile app reads cached refresh token, exchanges for access token (Entra ID, ~200ms)
3. App requests /api/sales/wt/summary?asOfDate=2026-04-22&bt=both
4. API validates JWT (local, ~1ms)
5. API checks Redis: HIT? → returns cached JSON
                     MISS? → queries reporting DB → caches → returns
6. App renders. Total: 80–300ms cached, 400–900ms cold.
```

## Data flow — approval action

```
1. User taps "Approve" on an LPO
2. App calls POST /api/inbox/{requestId}/approve with comment
3. API validates JWT, checks user has approval role for this BU
4. API:
   - Begins transaction
   - Updates ApprovalRequest.Status = 'Approved'
   - Inserts AuditLog row (user, action, IP, device, timestamp, before/after JSON)
   - Commits
5. API enqueues a notification fan-out job (next approver, requester)
6. Returns 200 to mobile
7. Mobile updates local inbox list
```

## Scaling considerations

This is an internal app for ~50 users. The bottleneck will not be the API or DB — both can serve this load on modest hardware (4 vCPU / 16 GB RAM per API instance, 8 vCPU / 32 GB for SQL Server). The bottleneck is going to be ETL freshness and dashboard query optimization on the reporting DB.

If the user base ever expands to ~500 (e.g. branch managers added), the same architecture holds — add a second SQL Server replica and bump cache.

## Failure modes

| Failure | Mitigation |
|---------|------------|
| Entra ID outage | Mobile shows "Sign in unavailable" but cached data still readable | 
| Reporting DB lag | API falls back to last successful snapshot; banner shows "Data as of HH:MM" |
| API instance crash | Load balancer routes to second instance; tokens are stateless so no session loss |
| Lost device | MDM remote-wipes; refresh token revoked via Entra ID admin |
| Approval double-tap | DB unique constraint on (RequestId, ApproverId, Status) prevents duplicates |

## Out of scope (v1)

- Push notifications (planned for v1.1 — APNS/FCM setup is non-trivial)
- Offline approvals (executives must be online to approve; reads can be offline)
- Multi-language UI (English only at launch; Arabic in v2)
- Branch-manager / lower-tier roles (executive scope only)
- Custom dashboard configuration per user (fixed layouts)

## Tech-debt corners worth knowing

- The prototype uses synthetic numbers; the real dashboards will surface data-quality issues (missing days, BU code mismatches between ERP and POS). Plan for a "data quality" sprint after first integration.
- Approval flows currently assume a single-step approver per request. If matrix approvals are needed (e.g. CEO + CFO both required), the schema supports it but the UI doesn't yet.
