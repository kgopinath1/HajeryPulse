# Security

## Threat model

Executive mobile app handling financial data, sales totals, and approval authority for purchases up to several million KWD. The realistic adversaries are:

1. **Lost or stolen device** — most likely scenario. Mitigated by biometric gate + MDM remote wipe + short refresh-token lifetime.
2. **Phishing for Entra ID credentials** — addressed by MFA enforcement on the Entra ID side (already standard at Hajery).
3. **Insider threat** — addressed by role-based scoping and append-only audit log.
4. **Network MitM** — addressed by HTTPS-only, certificate pinning on mobile, internal CA for the API.

Out of scope (handled at infra layer): DDoS, CDN, WAF — these are responsibilities of the data center perimeter team.

## Authentication

**Identity provider:** Microsoft Entra ID (Azure AD), Hajery tenant.

**Mobile flow:** OAuth 2.0 Authorization Code with PKCE.

1. App redirects user to Entra ID via in-app browser (ASWebAuthenticationSession on iOS, Custom Tabs on Android).
2. User authenticates with corporate credentials + MFA.
3. Entra ID redirects back to `hajerypulse://auth/callback` with an authorization code.
4. App POSTs code + verifier to `/api/v1/auth/exchange`.
5. API exchanges code with Entra ID for an access + refresh token; returns them to the app.
6. App stores refresh token in Keychain (iOS) / Keystore (Android), backed by hardware-backed keys where available.
7. Access token (1 hour) is held in memory only.

**Biometric gate:** Every cold start and after 5 minutes of background time, FaceID/TouchID/fingerprint is required to release the refresh token from secure storage. If biometric fails 3 times, the user is signed out.

**Token lifetimes:**
- Access token: 1 hour (Entra ID default; configurable).
- Refresh token: 14 days, sliding (renewed on each use). Revoked immediately on Entra ID admin action.

**API validation:** The API uses `Microsoft.Identity.Web` to validate JWTs locally against Entra ID's public keys. No per-request call to Entra ID.

## Authorization

Role assignments live in `dim.User.Roles` (JSON array). Roles include:

- `ceo` — sees all BUs, can approve all amounts
- `cfo` — sees all BUs, approves above thresholds
- `bu_head_healthcare` / `bu_head_fmcg` / `bu_head_pc` — scoped to their BU
- `approver_lpo` — can approve LPOs up to the assigned threshold
- `approver_asset` — can approve asset purchases up to the assigned threshold
- `viewer` — read-only

Authorization is enforced at the controller level using policy-based authorization (`[Authorize(Policy = "ApproveLpo")]`) and at the data layer by filtering on `dim.User.ScopedBuCodes` for any query that returns multi-BU data.

## Audit logging

Every mutating action and every dashboard load by an executive is logged to `audit.Event`. The middleware captures:

- User key + Entra object ID + display name
- Action type
- Entity type/ID (e.g. `Approval/LPO-2026-1042`)
- Before/after JSON for state changes
- Client IP, device info (User-Agent), trace ID

The audit log is INSERT-only — the API service principal does not have UPDATE or DELETE permissions on `audit.Event`. SELECT is restricted to a compliance role.

Retention: 7 years per Kuwaiti commercial-record law.

## Transport security

- TLS 1.2+ only, HTTP/2 preferred
- Certificate pinning on mobile against the API's internal CA cert (pinned via `react-native-cert-pinner`); fallback to system trust if pin fails after 3 attempts (so cert rotation doesn't brick the app)
- HSTS headers on the API
- CORS: API allows only `null` origin (mobile) and the Swagger origin in dev

## Mobile device management

Required device posture (enforced via Microsoft Intune):

- Passcode/biometric mandatory
- Device encryption on
- iOS 15+ / Android 10+
- App is "managed" so corporate data can be wiped without wiping personal data
- Copy/paste from app to non-managed apps disabled (optional, per Hajery policy)

## Secrets management

- API connection strings in `appsettings.Production.json` encrypted via DPAPI (Windows) or sourced from environment variables / Azure Key Vault (if hybrid)
- Mobile app: no secrets bundled (Entra ID client ID is public; client secret is not used for public clients)
- TLS certificates rotated annually; pin update pushed via app store before expiry

## Secure coding standards

- All SQL parameterized via Dapper (no string concatenation)
- All user input validated with FluentValidation before reaching the data layer
- Output encoded by ASP.NET Core's default JSON serializer (no custom escape logic)
- React Native uses `Text` component exclusively for user-rendered strings (no `dangerouslySetInnerHTML`)
- Dependencies pinned and scanned via Dependabot / `npm audit` / `dotnet list package --vulnerable` weekly

## Known gaps to close before production

- [ ] Penetration test against staging
- [ ] OWASP MSTG checklist run against the mobile app
- [ ] Entra ID Conditional Access policies confirmed (require compliant device + MFA for this app)
- [ ] DLP review with Hajery's compliance team
- [ ] Certificate-pin rotation runbook documented
- [ ] Incident-response runbook for compromised device / leaked refresh token
