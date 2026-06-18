# MaltaPro EAS Build Guide

The Expo app lives in:

```text
apps/mobile
```

Use the repo root npm scripts or run EAS from `apps/mobile`. Do not run raw `npx eas ...` from the repository root because the root is a monorepo workspace, not the Expo app.

## Project IDs

- Android package: `mt.marketplace.craftsman`
- iOS bundle identifier: `mt.marketplace.craftsman`
- EAS project ID: `783f09f3-8378-4d15-b699-9bdfc2b4842f`

The only EAS config file is:

```text
apps/mobile/eas.json
```

## Required EAS Environment Variables

Set these in EAS before building.

Preview environment:

```env
EXPO_PUBLIC_API_URL=https://YOUR_STAGING_OR_NGROK_API_URL/api/v1
EXPO_PUBLIC_ALLOW_MOCK_PURCHASES=true
EXPO_PUBLIC_API_LOGGING=true
GOOGLE_SERVICES_JSON_BASE64=base64 encoded apps/mobile/google-services.json
```

Production environment:

```env
EXPO_PUBLIC_API_URL=https://maltapro-api.onrender.com/api/v1
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=goog_xxx
EXPO_PUBLIC_ALLOW_MOCK_PURCHASES=false
EXPO_PUBLIC_API_LOGGING=false
GOOGLE_SERVICES_JSON_BASE64=base64 encoded apps/mobile/google-services.json
```

`GOOGLE_SERVICES_JSON_BASE64` is required so Android Firebase/FCM is initialized in cloud builds.

Create the Firebase value from PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("apps/mobile/google-services.json"))
```

Create it from Git Bash:

```bash
base64 -w 0 apps/mobile/google-services.json
```

Save EAS env vars from `apps/mobile`:

```bash
npx eas-cli@latest env:create --scope project --environment preview --name EXPO_PUBLIC_API_URL --value "https://YOUR_STAGING_OR_NGROK_API_URL/api/v1"
npx eas-cli@latest env:create --scope project --environment production --name EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID --value "goog_xxx" --visibility sensitive
npx eas-cli@latest env:create --scope project --environment production --name GOOGLE_SERVICES_JSON_BASE64 --value "PASTE_BASE64_VALUE" --visibility sensitive
```

## Preview APK

Preview is for direct install and internal QA. It creates an APK and does not upload to Google Play.

From repo root:

```bash
npm run mobile:build:preview
```

From `apps/mobile`:

```bash
npx eas-cli@latest build --platform android --profile preview
```

The preview profile requires a public HTTPS API URL. It should point at staging, ngrok, or another QA backend, not Render production unless you intentionally configure it that way.

## Production AAB

Production is for Google Play Internal Testing / Play Store. It creates an AAB.

From repo root:

```bash
npm run mobile:build:production
```

From `apps/mobile`:

```bash
npx eas-cli@latest build --platform android --profile production
```

Production uses:

```text
https://maltapro-api.onrender.com/api/v1
```

and requires the RevenueCat Android public key in EAS:

```env
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=goog_xxx
```

## Submit Production To Google Play

After the production AAB is built, upload it manually to Google Play Console Internal Testing, or submit through EAS:

```bash
npm run mobile:submit:production
```

Manual upload path:

1. Open Google Play Console.
2. Select MaltaPro.
3. Go to Testing > Internal testing.
4. Create a new release.
5. Upload the production `.aab`.
6. Save and roll out to internal testers.

## Firebase / FCM

The local file:

```text
apps/mobile/google-services.json
```

must belong to Android package:

```text
mt.marketplace.craftsman
```

This file is ignored by git. EAS cloud builds get it from `GOOGLE_SERVICES_JSON_BASE64`.

If Android push token generation fails with Firebase initialization errors, rebuild after confirming:

- `GOOGLE_SERVICES_JSON_BASE64` exists in the EAS environment used by the build;
- the Firebase Android app package is `mt.marketplace.craftsman`;
- EAS Android FCM V1 credentials are configured.

## Useful Checks

From `apps/mobile`:

```bash
npx eas-cli@latest project:info
npx eas-cli@latest build:list --platform android
npx eas-cli@latest credentials
```

From repo root:

```bash
npm run mobile:build:preview
npm run mobile:build:production
```
