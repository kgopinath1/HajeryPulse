# API Specification

Base URL: `https://api.hajerypulse.internal/api/v1`

All endpoints require an Authorization header: `Bearer <access_token>`. Tokens are JWTs issued by Microsoft Entra ID for the configured app registration.

## Conventions

- All money fields are in KWD (Kuwaiti Dinar) thousands unless explicitly noted with a `Kwd` suffix.
- Dates are ISO-8601 (`2026-04-22`).
- The `asOfDate` query parameter scopes every dashboard query. Default is yesterday (Day −1).

## Auth

### `POST /auth/exchange`
Exchange an Entra ID authorization code for an API access token + refresh token.

```json
Request:  { "code": "...", "codeVerifier": "..." }
Response: { "accessToken": "...", "refreshToken": "...", "expiresAt": "2026-04-22T15:30:00Z", "user": { "id": "...", "name": "...", "roles": ["ceo"] } }
```

### `POST /auth/refresh`
```json
Request:  { "refreshToken": "..." }
Response: { "accessToken": "...", "expiresAt": "..." }
```

## Sales — Wholesale & Tender

### `GET /sales/wt/summary?asOfDate&bt`
Top revenue card + KPI grid for the W&T tab. `bt` ∈ `both | wholesale | tender`.

```json
{
  "asOfDate": "2026-04-22",
  "bt": "both",
  "revenue": { "kwd": 8640, "wow": 5.4 },
  "kpis": {
    "newOrders": 142,
    "openOrderValueKwd": 2840,
    "activeTenders": 18,
    "avgTenderValueKwd": 234
  },
  "spark": [85, 70, 80, 55, 62, 45, 50, 30]
}
```

### `GET /sales/wt/margin?asOfDate&bt`
Margin Analysis widget data.

```json
{
  "marginPct": 34.9,
  "marginPctLY": 33.7,
  "marginYoyPp": 1.2,
  "netSalesKwd": 8420,
  "cogsKwd": 5480,
  "grossMarginKwd": 2940,
  "trend12mo": [...],
  "trend12moLY": [...]
}
```

### `GET /sales/wt/quality?asOfDate&bt`
Sales Quality widget (Gross → Returns → Cancellations → Net).

```json
{
  "grossKwd": 8910,
  "returnsKwd": 312,
  "cancellationsKwd": 178,
  "netKwd": 8420,
  "netPct": 94.5,
  "returnsPct": 3.5,
  "cancellationsPct": 2.0
}
```

### `GET /sales/wt/org?asOfDate&bt&parent`
Org-structure drill-down. `parent` is a node key (`root`, `HC00`, `PD100`, `PA50`, etc.). Returns the children of that parent with current-scope amounts.

```json
{
  "level": "Division",
  "label": "HEALTHCARE",
  "parentKey": "HC00",
  "children": [
    { "key": "PD100", "code": "PD100", "name": "Pharmaceutical", "amtW": 2200, "amtT": 1450, "yoy": 13.2 },
    ...
  ]
}
```

### `GET /sales/wt/top-brands?asOfDate&bt&limit=10`
### `GET /sales/wt/top-customers?asOfDate&bt&limit=10`

## Pharmacies

### `GET /pharma/list`
All 29 pharmacies + the synthetic "all" entry, with current-week amounts.

### `GET /pharma/summary?asOfDate&pharmacyId`
KPI grid + revenue card. `pharmacyId` defaults to `all`.

### `GET /pharma/margin?asOfDate&pharmacyId`
### `GET /pharma/quality?asOfDate&pharmacyId`
### `GET /pharma/channels?asOfDate&pharmacyId`
### `GET /pharma/payments?asOfDate&pharmacyId`
### `GET /pharma/categories?asOfDate&pharmacyId&limit=10`
### `GET /pharma/rx-otc-mix?asOfDate&pharmacyId`
### `GET /pharma/discount-leaderboard?asOfDate&limit=10`
### `GET /pharma/top?asOfDate&limit=10`

## F&B

### `GET /fb/brands`
Returns all 12 brands with metadata.

### `GET /fb/outlets?brand={id}`
Returns the 43 outlets, optionally filtered by brand.

### `GET /fb/summary?asOfDate&scopeType&scopeId`
`scopeType` ∈ `all | brand | outlet`. `scopeId` is the brand ID or outlet code.

### `GET /fb/brand-summary?asOfDate&scopeType&scopeId`
### `GET /fb/aggregators?asOfDate&scopeType&scopeId`
### `GET /fb/payments?asOfDate&scopeType&scopeId`
### `GET /fb/delivery-by-brand?asOfDate&scopeType&scopeId`
### `GET /fb/top-outlets?asOfDate&scopeType&scopeId&limit=10`

## Finance & Ops

### `GET /finance/health?asOfDate`
Margin donut, AR/AP, working capital.

### `GET /finance/ops?asOfDate`
SLA, fill rate, turn time.

## Inbox

### `GET /inbox?status=pending&limit=50`
List of approval requests scoped to the current user.

```json
{
  "items": [
    {
      "id": "LPO-2026-1042",
      "type": "lpo",
      "title": "Bulk paracetamol — Q2 inventory",
      "amountKwd": 84,
      "requester": "Ahmed Al-Sabah",
      "submittedAt": "2026-04-21T08:42:00Z",
      "status": "pending"
    },
    ...
  ]
}
```

### `GET /inbox/{id}`
Full request detail with line items, attachments, history.

### `POST /inbox/{id}/approve`
```json
Request:  { "comment": "Approved — bulk discount confirmed." }
Response: { "id": "...", "status": "Approved", "decidedAt": "..." }
```

### `POST /inbox/{id}/reject`
```json
Request:  { "comment": "Rejected — waiting on price comparison." }
```

### `POST /inbox/{id}/clarify`
```json
Request:  { "question": "Please share price comparison vs last quarter." }
```

## Error envelope

All non-2xx responses share this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "asOfDate must not be in the future.",
    "traceId": "00-abc...-..."
  }
}
```

Common codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CACHE_MISS_DOWNSTREAM`, `INTERNAL_ERROR`.
