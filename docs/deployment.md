# Deployment

## Production topology

```
Internet
   │
   ▼
┌─────────────────────────┐
│  Hajery Edge Firewall   │
└────────┬────────────────┘
         │
   ┌─────▼─────┐
   │  WAF      │   (ModSecurity + OWASP ruleset)
   └─────┬─────┘
         │
   ┌─────▼─────────────────┐
   │  nginx (reverse proxy)│   TLS termination, HSTS, cert pinning
   │  + rate limit         │   100 req/min/IP for /api/*, 10/min for /auth/*
   └─────┬─────────────────┘
         │
   ┌─────▼──────────┬────────────────┐
   │ ASP.NET Core   │ ASP.NET Core   │   2 instances, round-robin
   │ instance #1    │ instance #2    │   Kestrel on :5001
   └─────┬──────────┴────────┬───────┘
         │                   │
         └────┬──────────────┘
              │
        ┌─────▼─────┐         ┌──────────────┐
        │  Redis    │         │ SQL Server   │
        │  (cache)  │         │ Always-On AG │
        └───────────┘         └──────────────┘
                                 (1 primary + 1 secondary)
```

## Environments

| Env | Purpose | DB | Mobile build |
|-----|---------|-----|--------------|
| `dev`     | Active development | LocalDB / SQL Express | Debug bundle, dev signing |
| `staging` | UAT, security testing | SQL Server (separate instance, masked data) | Ad-hoc / TestFlight / Internal track |
| `prod`    | Live | SQL Server reporting replica | App Store / Play Store production |

## API deployment

### Option A — IIS on Windows Server (recommended for Hajery)

```bash
# Build self-contained
cd api
dotnet publish HajeryPulse.Api -c Release -r win-x64 --self-contained false -o ./publish

# Deploy to IIS app pool
# (run on the target Windows Server)
Stop-WebAppPool -Name "HajeryPulse"
robocopy .\publish C:\inetpub\wwwroot\HajeryPulse /MIR
Start-WebAppPool -Name "HajeryPulse"
```

App pool config:
- .NET CLR Version: "No Managed Code" (because we use the AspNetCoreModuleV2 in-process)
- Identity: a domain service account with read access to the SQL Server reporting DB and INSERT to the audit DB
- Idle timeout: 0 (don't recycle on idle — small user base, slow first-request matters)
- Recycling: daily at 03:00

### Option B — Linux + Docker (alternative)

```bash
docker build -t hajerypulse/api:latest -f deploy/api.Dockerfile .
docker run -d --name hajerypulse-api \
  -p 5001:5001 \
  -e ConnectionStrings__ReportingDb="..." \
  -e EntraId__TenantId="..." \
  --restart unless-stopped \
  hajerypulse/api:latest
```

## Database deployment

```bash
# Run scripts in numbered order on the target server
sqlcmd -S sql-prod-01 -E -i database/01_schema/001_create_database.sql
sqlcmd -S sql-prod-01 -E -i database/01_schema/002_dim_tables.sql
sqlcmd -S sql-prod-01 -E -i database/01_schema/003_fact_tables.sql
sqlcmd -S sql-prod-01 -E -i database/01_schema/004_approval_tables.sql
sqlcmd -S sql-prod-01 -E -i database/01_schema/005_audit_log.sql
sqlcmd -S sql-prod-01 -E -i database/02_views/views.sql
sqlcmd -S sql-prod-01 -E -i database/03_procedures/sp_sales_wt.sql
sqlcmd -S sql-prod-01 -E -i database/03_procedures/sp_pharmacies.sql
sqlcmd -S sql-prod-01 -E -i database/03_procedures/sp_fb.sql
sqlcmd -S sql-prod-01 -E -i database/03_procedures/sp_inbox.sql

# DO NOT run seed script in production
# sqlcmd -S sql-prod-01 -E -i database/04_seed/seed_demo_data.sql
```

ETL setup:
1. Open SQL Server Agent → New Job → "HajeryPulse_Hourly_Refresh"
2. Step 1: T-SQL → `EXEC etl.RefreshFactSalesWT @IncrementalOnly = 1`
3. Step 2: T-SQL → `EXEC etl.RefreshFactPharmacySales @IncrementalOnly = 1`
4. Step 3: T-SQL → `EXEC etl.RefreshFactFBSales @IncrementalOnly = 1`
5. Schedule: every hour, 5 minutes past the hour
6. Notifications: on failure, email `data-ops@hajerygroup.com`

## Mobile deployment

### iOS (App Store / enterprise distribution)

```bash
cd mobile
npm install
cd ios && pod install && cd ..

# Build release
npx react-native build-ios --mode Release

# Or via Xcode for App Store submission:
# 1. Open ios/HajeryPulse.xcworkspace
# 2. Select "Generic iOS Device"
# 3. Product → Archive
# 4. Distribute App → App Store Connect or Enterprise
```

For internal distribution to ~50 executives, an Apple Enterprise Developer account is the cleanest option — bypass the App Store, distribute via MDM (Intune push-install). Avoids public review and lets you ship updates instantly.

### Android (Play Store / managed Play / sideload)

```bash
cd mobile/android
./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab

# Sign with the production keystore (kept in a secure vault):
# (This would normally be done by your CI / signing service)
```

For internal distribution, use **Managed Google Play** via Intune — same pattern as iOS Enterprise.

## CI/CD (recommended)

Use Azure DevOps (Hajery is a Microsoft shop, so this is the path of least resistance):

```yaml
# azure-pipelines.yml (skeleton)
trigger:
  branches: { include: [main, develop] }

stages:
  - stage: Build
    jobs:
      - job: Api
        steps:
          - task: UseDotNet@2 ; inputs: { version: '8.x' }
          - script: dotnet test api/HajeryPulse.Api.Tests
          - script: dotnet publish api/HajeryPulse.Api -c Release -o $(Build.ArtifactStagingDirectory)/api
          - task: PublishBuildArtifacts@1

      - job: Mobile
        steps:
          - task: NodeTool@0 ; inputs: { versionSpec: '20.x' }
          - script: cd mobile && npm ci && npm run lint && npm test
          - script: cd mobile/android && ./gradlew bundleRelease
          - task: PublishBuildArtifacts@1

  - stage: Deploy_Staging
    dependsOn: Build
    condition: succeeded()
    jobs:
      - deployment: Api
        environment: staging
        strategy: { runOnce: { deploy: { steps: [...] } } }

  - stage: Deploy_Production
    dependsOn: Deploy_Staging
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - deployment: Api
        environment: production
        strategy: { runOnce: { deploy: { steps: [...] } } }
```

## Monitoring

- **Metrics:** Application Insights (or Prometheus + Grafana). Key dashboards: request rate, p95/p99 latency by endpoint, 5xx rate, cache hit rate, DB connection pool saturation.
- **Logs:** Serilog → file + Application Insights → Log Analytics workspace.
- **Alerts:** PagerDuty or Teams webhook for: API 5xx > 1% over 5 min, DB connection failures, Entra ID validation failures spiking (could indicate cert rotation needed).
- **Mobile crash reporting:** Sentry or Firebase Crashlytics.

## Backup & DR

- SQL Server: full backup nightly, log backup every 15 min, retained 30 days. Tested restore quarterly.
- API stateless — no backup needed beyond config.
- Approvals table is the only "must not lose" data. It's in the same SQL Server as the reporting tables and covered by the same backup policy. Consider: replicate `app.*` and `audit.*` tables to a second SQL Server for tenfold safety.

## Rollback

API: previous build artifact is kept on the server (`C:\inetpub\wwwroot\HajeryPulse_previous`). Rollback = stop pool, swap folders, start pool. < 60 sec.

Database: schema migrations are forward-only (never DROP). Rollback for schema is "fix forward" — never roll back. Rollback for stored procedures: each script keeps the previous version commented at the top; restore via re-running.

Mobile: app stores allow rollback via "expedited release of previous version". Plan for 24-hour rollback window for mobile (vs minutes for API).
