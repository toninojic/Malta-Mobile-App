# Android APK Testing

The APK contains the Expo React Native app only. The NestJS API and PostgreSQL database must run separately on a public URL so testers outside your Wi-Fi network can use login, registration, jobs, offers, tokens, chat, and reviews.

## Public Backend

For a temporary test, keep the API running on your machine and expose port `3000` with a tunnel:

```bash
cd "/e/10. Malta App"
npm run api:dev
```

In another terminal:

```bash
ngrok http 3000
```

Use the HTTPS URL from ngrok and confirm the API is reachable:

```bash
curl https://your-ngrok-url.ngrok-free.app/api/v1/health
```

For longer testing, deploy the API and PostgreSQL to a real host such as Render, Railway, Fly.io, or a VPS, then run Prisma migrations and seed data against that database.

## Configure Mobile API URL

The Android build reads `EXPO_PUBLIC_API_URL` at build time. Set it before creating the APK:

```bash
cd "/e/10. Malta App"
npm run mobile:api-url:set -- https://your-public-api.example.com/api/v1
npm run mobile:api-url:check
```

If you pass a base URL without `/api/v1`, the helper appends `/api/v1`.

## Build APK With EAS

Log in to Expo/EAS once:

```bash
cd "/e/10. Malta App/apps/mobile"
npx eas-cli@latest login
```

Create the APK:

```bash
cd "/e/10. Malta App"
npm run mobile:apk
```

The `preview` EAS profile builds an Android `.apk` suitable for direct tester installation.

## Important Notes

- If the public API URL changes, rebuild the APK.
- If using ngrok, keep both `npm run api:dev` and `ngrok http 3000` running while testers use the APK.
- The mobile client sends `ngrok-skip-browser-warning` automatically for `ngrok-free.app` API URLs.
- A test APK should point to HTTPS whenever possible.
