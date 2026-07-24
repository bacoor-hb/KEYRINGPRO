# Setup

KEYRING PRO is a React Native (0.81, New Architecture) multi-chain crypto wallet.
This guide helps you build and run a development build from a fresh clone.
Secrets and Firebase config are **not** included in the repo — you provide your
own via the templates below.

## 1. Prerequisites
- Node 18+ and Yarn 1.x
- Watchman (macOS)
- Ruby + Bundler + CocoaPods (iOS)
- JDK 17 (`JAVA_HOME` must point at a JDK 17)
- Xcode 15+ (iOS) / Android Studio + SDK (Android)

## 2. Install JS dependencies
```bash
yarn install          # runs patch-package via postinstall
```

## 3. Configuration

### Required for building — create these files
The native build needs `.env` and `keys.release.json` to **exist**. Copy the
templates as-is — the placeholder values are enough for the app to compile,
launch and create/manage wallets:

```bash
cp .env.example .env
cp keys.release.example.json keys.release.json
```

A **native rebuild** is required after editing either file — `react-native-config`
and `react-native-keys` generate native constants at build time, so a Metro
reload is not enough.

### Optional — fill in values to unlock features
Nothing below is mandatory for the app to run. Each value simply enables the
feature it powers; leave it as the placeholder to skip that feature.

**`.env`**
- `WALLETCONNECT_PROJECT_ID` — required only if you want **WalletConnect** to
  work. Create one at https://cloud.reown.com.
- `SERVICE_QUICKNODE_ENDPOINT_NAME` — your QuickNode endpoint subdomain, used
  together with the QuickNode key below for stable RPC. **Leave empty and the
  app falls back to public RPC** automatically.
- Backend hosts (`KEYRING_API`, etc.) — the defaults point at Keyring's public
  endpoints and work out of the box. Repoint them only if you self-host a
  backend. Do not add a trailing slash to any host.

**`keys.release.json`** (obfuscated into the binary at build via `react-native-keys`)
- `SERVICE_QUICKNODE_API_KEY` — pairs with `SERVICE_QUICKNODE_ENDPOINT_NAME` to
  give the app a stable, paid RPC. **If not set, the app uses free/public RPC.**
- `SERVICE_MORILIS_API_KEY` — Moralis key used to fetch a user's token balances
  across many chains. **Not set → tokens on many chains may not show up.**
- `AGENT_CORE_GEMINI_API_KEY` — enables the in-app **AI assistant**. Without it
  the AI feature is unavailable.

## 4. Firebase (push notifications)
Create a Firebase project and download the config files, then place them:
```bash
cp android/app/google-services.example.json android/app/google-services.json
cp ios/GoogleService-Info.example.plist     ios/GoogleService-Info.plist
```
Replace the placeholders with the values from your own Firebase project. The
`package_name` / `BUNDLE_ID` must match your app id.

## 5. iOS pods
```bash
yarn pod              # bundle exec pod install (New Arch enabled)
```

## 6. Run
```bash
yarn start            # Metro bundler
yarn ios              # build & run iOS
yarn android          # build & run Android
```

## 7. Useful scripts
```bash
yarn audit:pk-leak    # scan source for accidental private-key leaks
```
`yarn audit:pk-leak` is only a best-effort guard to reduce the chance of a
developer committing a key by mistake — it is a heuristic scan, **not** a
guarantee that the source is free of secrets. Do not rely on it as your only
safeguard.

## Notes
- App ships **dark mode only**.
- JavaScript only — the codebase does not use TypeScript.
