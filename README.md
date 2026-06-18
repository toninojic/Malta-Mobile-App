# MaltaPro

MaltaPro is a mobile-first marketplace for the Malta market that connects employers with contractors and craftsmen such as plumbers, electricians, painters, builders, cleaners, handymen, and other service providers.

The product is built as a monorepo with:

- `apps/api` - NestJS API, PostgreSQL, Prisma, JWT auth, role-based permissions, payments, notifications, reviews, chat, admin tools, and S3 storage.
- `apps/mobile` - Expo React Native app for Android and iOS.

## Main Features

- Employer, contractor, and admin roles.
- Employer job creation and management.
- Contractor job browsing, offers, work details, and contact unlock flow.
- Token wallet and RevenueCat purchase integration.
- In-app notifications and Expo push notification support.
- Chat after contact unlock.
- Job completion and review flow.
- Contractor portfolio and verification flow.
- Admin management for users, jobs, offers, refunds, reviews, chats, verifications, and statistics.
- AWS S3 compatible image/document storage.

## Requirements

- Node.js `22.13.0` or newer.
- npm.
- Docker Desktop.
- PostgreSQL, either through Docker or a hosted database.
- Expo/EAS account for mobile builds.

Recommended Node version is stored in:

- `.nvmrc`
- `.node-version`

On Windows with `nvm-windows`:

```bash
nvm install 22.13.0
nvm use 22.13.0
node -v
```

## Local Setup

From Git Bash:

```bash
cd "/e/10. Malta App"
npm install
```

Create local environment files from the examples if they exist:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
```

Start PostgreSQL:

```bash
docker compose up -d postgres
```

Run migrations and seed data:

```bash
npm run prisma:migrate --workspace @malta-marketplace/api
npm run prisma:seed --workspace @malta-marketplace/api
```

Start the API:

```bash
npm run api:dev
```

Default test accounts:

```text
employer@malta.test / Password123!
contractor@malta.test / Password123!
admin@malta.test / Password123!
```

## Mobile App

Start Expo:

```bash
npm run mobile:start
```

For testing on a real phone, the mobile app needs a public HTTPS API URL. For local testing, expose the API with ngrok or another tunnel, then run:

```bash
npm run mobile:api-url:set -- https://your-public-api-url.example.com
npm run mobile:api-url:check
```

Build Android APK/AAB through EAS:

```bash
npm run mobile:apk
```

Use the EAS wrapper in this repo to avoid noisy Node deprecation warnings:

```bash
npm run eas:project:info
npm run eas -- build --platform android --profile production
```

## Production Notes

The backend is designed to run on Render or another Docker-based Node hosting platform.

Production backend needs, at minimum:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `APP_ORIGIN`
- `AWS_REGION`
- `AWS_S3_BUCKET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- RevenueCat webhook secret/config if purchases are enabled.

Mobile production builds need:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID`
- `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` when iOS is enabled.
- Expo/EAS project configuration.
- Firebase/FCM configuration for Android push notifications.

## Secrets And Firebase Files

Do not commit secrets to git.

These files must stay local or be provided through EAS/CI secrets:

- `.env`
- `.env.*`
- `apps/mobile/google-services.json`
- `apps/mobile/GoogleService-Info.plist`

If Firebase files are needed locally, keep them in `apps/mobile`, but leave them ignored by git. For production builds, prefer EAS secrets or EAS file secrets instead of committing them.

If a secret file was already committed, remove it from git history or rotate the secret in the provider dashboard. Removing it from the current commit is not enough if it was pushed publicly.

### Hide `google-services.json`

The Android Firebase file is ignored by git and can stay locally at:

```text
apps/mobile/google-services.json
```

For EAS builds, store it as a secret instead of committing it.

Create a base64 value from Git Bash:

```bash
base64 -w 0 apps/mobile/google-services.json
```

On PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("apps/mobile/google-services.json"))
```

Save that value in EAS:

```bash
npm run eas -- secret:create --scope project --name GOOGLE_SERVICES_JSON_BASE64 --value "PASTE_BASE64_VALUE_HERE"
```

If your installed EAS CLI recommends the newer environment command, use:

```bash
npm run eas -- env:create --scope project --name GOOGLE_SERVICES_JSON_BASE64 --value "PASTE_BASE64_VALUE_HERE" --visibility sensitive
```

During EAS build, `apps/mobile/app.config.js` recreates `google-services.json` from `GOOGLE_SERVICES_JSON_BASE64`.

If `google-services.json` was already pushed to GitHub:

1. Rotate or restrict the Firebase/Google API key in Google Cloud Console.
2. Commit the removal from git.
3. If the repository is public or shared, purge the old file from git history with `git filter-repo` or BFG Repo-Cleaner, then force-push.

## Useful Commands

Typecheck all workspaces:

```bash
npm run typecheck
```

API build:

```bash
npm run build --workspace @malta-marketplace/api
```

Run API smoke tests after the API is running:

```bash
npm run smoke:milestone10 --workspace @malta-marketplace/api
```

Check configured mobile API URL:

```bash
npm run mobile:api-url:check
```
