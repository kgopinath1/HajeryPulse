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
sqlcmd -S localhost -E -i 01_schema/007_user_email_identity.sql
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
- `SELECT, INSERT, UPDATE` on `app.DeviceToken`; `SELECT, UPDATE` on `dim.[User]`

A compliance role (separate principal) gets `SELECT` on `audit.Event`.

## Indexing

The current scripts include the most useful read indexes for the dashboards.
After 6 months of production data, run a query-store review and add indexes
where the optimizer is doing scans. Don't pre-index speculatively — wait for
the workload to settle.

## Users and device tokens (IT)

**1. Give the user access.** Only emails in `dim.[User]` with `IsActive = 1`
get past sign-in; anyone else sees "Your account doesn't have access".

```sql
EXEC app.usp_User_Add @Email = N'someone@hajery.com', @DisplayName = N'Some One';
EXEC app.usp_User_SetActive @Email = N'someone@hajery.com', @IsActive = 0;  -- leaver: also turns off their devices
```

**2. Issue a token when asked.** On a new phone (or after a factory reset)
the app shows **Get token**. Tapping it emails everyone in
`app.DeviceTokenRecipient` with the user, device and a request ID. Then:

```sql
EXEC app.usp_Device_IssueToken @RequestId = 12;
-- → Token (e.g. K7QM-4XPD), ExpiresKuwait
EXEC app.usp_Device_Requests;      -- open requests, if an email went missing
```

Send the token to the user (Teams, email or in person).

- A token is for that one phone of that user and must be entered within
  **2 hours**. Issuing again for the same request replaces the earlier token.
- 5 wrong attempts lock it; the user taps "ask again" and IT issues a new one.
- **Reinstalling keeps the device.** The app uses the phone's own ID (iOS
  identifierForVendor, Android ANDROID_ID), which survives a reinstall. On
  iOS the token survives too, so the app just works. On Android the user
  enters the **same token** again. If they've lost it, "Get token" reopens
  the same request (the old token stops working) and you issue a new one.
- A factory reset or a new phone has a new ID and needs a new token.
- A user can have **2** active devices. For a third, turn one off first.

Other tasks:

```sql
EXEC app.usp_Device_List;                                    -- every active device
EXEC app.usp_Device_List @Email = N'someone@hajery.com';     -- one user's devices and requests
EXEC app.usp_Device_Deactivate @DeviceTokenId = 12, @Reason = N'Phone lost';
EXEC app.usp_Device_Deactivate @Email = N'someone@hajery.com';  -- all their devices

-- Who gets the "Get token" emails. Takes effect on the next request; no redeploy.
EXEC app.usp_Device_Recipients;
EXEC app.usp_Device_SetRecipient @Email = N'someone@hajery.com';                 -- add
EXEC app.usp_Device_SetRecipient @Email = N'someone@hajery.com', @IsActive = 0;  -- stop
```

A turned-off device or user is locked out within a minute. The App Store /
Play review demo account needs neither. The old `dbo.Devices` table is no
longer used and can be dropped.

### One-time setup: email to IT

The API sends the "Get token" emails through Microsoft Graph, as
`helpdesk@hajery.com` (the API's `DeviceTokens:NotifyFrom`), signed in as
its own app registration **Hajery Pulse API** (App ID
`b6487636-354c-483e-94a4-e408271e36b2`). Until this is set up, requests are
still saved and listed by `app.usp_Device_Requests`; only the email isn't sent.

`helpdesk@hajery.com` must be an Exchange Online mailbox (user or shared).

**A. Create a client secret** (Entra admin center, as an app admin)

1. <https://entra.microsoft.com> → **Applications → App registrations → All
   applications** → open the one with App ID `b6487636-…`.
2. **Certificates & secrets → Client secrets → New client secret**.
   Description `Hajery Pulse mail`, expiry 24 months → **Add**.
3. Copy the **Value** column straight away (not the Secret ID; the value is
   only shown once). Put a reminder in the calendar to renew it before it
   expires — emails stop when it does.
4. Under **API permissions**, make sure Microsoft Graph **Mail.Send** is *not*
   listed. That permission would let the app send as anyone; step C limits
   it to the helpdesk mailbox instead.

**B. Store the secret on the API server** (encrypted, like the connection string)

On the IIS server itself (the encryption is tied to that machine), in
PowerShell **as Administrator**:

```powershell
Add-Type -AssemblyName System.Security
$secure  = Read-Host "Paste the client secret value" -AsSecureString
$plain   = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
$entropy = [Text.Encoding]::UTF8.GetBytes("HajeryPulse")
$cipher  = [Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($plain), $entropy, "LocalMachine")
$encrypted = [Convert]::ToBase64String($cipher)
$plain = $null

# Use the API's application pool name (IIS Manager → Application Pools).
$pool = "HajeryPulse"
& "$env:windir\system32\inetsrv\appcmd.exe" set config -section:system.applicationHost/applicationPools `
  "/+[name='$pool'].environmentVariables.[name='DeviceTokens__MailClientSecret_Encrypted',value='$encrypted']" /commit:apphost
& "$env:windir\system32\inetsrv\appcmd.exe" recycle apppool /apppool.name:"$pool"
```

To replace it later (renewal), remove the old value first:

```powershell
& "$env:windir\system32\inetsrv\appcmd.exe" set config -section:system.applicationHost/applicationPools `
  "/-[name='$pool'].environmentVariables.[name='DeviceTokens__MailClientSecret_Encrypted']" /commit:apphost
```

then run the block above again.

**C. Allow the app to send only as helpdesk@** (Exchange Online, as an Exchange admin)

1. Find the **Enterprise application's Object ID**: Entra admin center →
   **Applications → Enterprise applications** → search `b6487636` → open it →
   **Overview → Object ID**. (This is different from the app registration's
   object ID.)
2. In PowerShell:

   ```powershell
   Install-Module ExchangeOnlineManagement -Scope CurrentUser   # once
   Connect-ExchangeOnline -UserPrincipalName <your admin account>

   New-ServicePrincipal -AppId b6487636-354c-483e-94a4-e408271e36b2 `
     -ObjectId <Enterprise application Object ID> -DisplayName "Hajery Pulse API"

   New-ManagementScope -Name "HajeryPulse helpdesk mailbox" `
     -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'helpdesk@hajery.com'"

   New-ManagementRoleAssignment -App b6487636-354c-483e-94a4-e408271e36b2 `
     -Role "Application Mail.Send" -CustomResourceScope "HajeryPulse helpdesk mailbox"
   ```

3. Check it:

   ```powershell
   Test-ServicePrincipalAuthorization -Identity b6487636-354c-483e-94a4-e408271e36b2 -Resource helpdesk@hajery.com
   # Application Mail.Send ... InScope : True
   Test-ServicePrincipalAuthorization -Identity b6487636-354c-483e-94a4-e408271e36b2 -Resource keerthana.gopinath@hajery.com
   # InScope : False   (it can't send as anyone else)
   ```

   New permissions can take 30 minutes to 2 hours to apply.

**D. Test.** Tap **Get token** in the app. If no email arrives, the API log
(`logs/hajery-pulse-*.log`) has a line starting `Device token request … not
emailed` with the reason:

| Reason in the log | Fix |
|---|---|
| `NotifyFrom or MailClientSecret isn't set` | Step B: variable name, app pool name, or the pool wasn't recycled |
| `no active rows in app.DeviceTokenRecipient` | `EXEC app.usp_Device_SetRecipient @Email = N'...'` |
| `AADSTS7000215` / `invalid_client` | Wrong or expired secret — step A/B again |
| `Graph returned 403 ... ErrorAccessDenied` | Step C not applied yet (wait), or the scope doesn't match helpdesk@ |
| `Graph returned 404 ... MailboxNotEnabledForRESTAPI` | helpdesk@ isn't an Exchange Online mailbox |

**Block unregistered users at Microsoft sign-in.** The API refuses anyone
not in `dim.[User]`, but to stop them signing in at all: Entra ID →
Enterprise applications → Hajery Pulse → Properties → **Assignment required =
Yes**, then add the same users (or a group) under **Users and groups**. Add
the App Store review account too.
