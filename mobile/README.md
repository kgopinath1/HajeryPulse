# Hajery Pulse — Mobile

React Native + TypeScript app targeting iOS 15+ and Android 10+.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. iOS — install pods
cd ios && pod install && cd ..

# 3. Run
npm run ios          # or
npm run android
```

## Project layout

```
src/
├── api/          REST clients (one file per feature area)
├── auth/         Entra ID, biometric, token storage, AuthContext
├── components/   Reusable UI (Card, KpiTile, Chip, SectionTitle, etc.)
├── navigation/   RootNavigator (auth gate) + AppTabs (5 main tabs)
├── screens/      Login, WholesaleTender, Pharmacies, FB, FinanceOps, Inbox, ApprovalDetail
├── theme/        Colors, typography, spacing tokens (mirrors prototype)
├── types/        Domain types shared with API DTOs
└── utils/        Formatters (KWD, dates), helpers
```

## Configuration

Before first run:

1. Open `src/auth/entraId.ts` and set `tenantId`, `clientId` from Entra ID app registration.
2. Open `src/api/client.ts` and confirm `BASE_URL` for your environment.
3. iOS: in `ios/HajeryPulse/Info.plist` register the URL scheme `hajerypulse://`.
4. Android: in `android/app/src/main/AndroidManifest.xml` register the same scheme as an `<intent-filter>`.

## Linting and type-checking

```bash
npm run lint
npm run typecheck
```

## Building for release

See [../docs/deployment.md](../docs/deployment.md) for detailed iOS Enterprise / Managed Play instructions.

## Environment switching

The dev build uses `http://10.0.2.2:5001/api/v1` (Android emulator → host loopback). For iOS simulator use `http://localhost:5001/api/v1`. Production points at `https://api.hajerypulse.internal/api/v1`. Switch via `__DEV__` flag in `src/api/client.ts` — for multi-env builds, replace with `react-native-config` and a `.env` per build flavor.
