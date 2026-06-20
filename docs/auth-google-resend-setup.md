# MaltaPro Google OAuth and Resend Setup

This guide explains how to activate and test:

- Continue with Google
- Email verification
- Resend verification email
- Forgot password
- Reset password

The mobile app uses Expo Auth Session. The backend verifies Google ID tokens and sends email through Resend.

## Backend Env

Add these to the production API environment on Render and to `apps/api/.env` for local testing:

```env
APP_PUBLIC_URL=https://your-public-frontend-or-landing-page.example.com
MOBILE_DEEP_LINK_SCHEME=maltapro

GOOGLE_ANDROID_CLIENT_ID=
GOOGLE_IOS_CLIENT_ID=
GOOGLE_WEB_CLIENT_ID=
GOOGLE_ALLOWED_CLIENT_IDS=

RESEND_API_KEY=
RESEND_FROM_EMAIL=MaltaPro <hello@yourdomain.com>

AUTH_ALLOW_MOCK_GOOGLE=false
AUTH_EMAIL_DEBUG_TOKENS=false
AUTH_EMAIL_DELIVERY_DISABLED=false
```

Local development can use:

```env
APP_PUBLIC_URL=http://localhost:8081
AUTH_EMAIL_DEBUG_TOKENS=true
AUTH_EMAIL_DELIVERY_DISABLED=true
```

`AUTH_EMAIL_DELIVERY_DISABLED=true` lets you test the auth flow without sending real emails. Do not enable it in production.

## Mobile Env

Add these to `apps/mobile/.env` locally and to EAS environment variables for preview/production builds:

```env
EXPO_PUBLIC_API_URL=https://maltapro-api.onrender.com/api/v1
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
```

Google client IDs are public identifiers, not client secrets. Never put a Google client secret in the mobile app.

## Google Setup

1. Open Google Cloud Console.
2. Create or select the MaltaPro project.
3. Configure OAuth consent screen:
   - App name: MaltaPro
   - Support email: your owner email
   - Add authorized domain if using a website fallback.
4. Create OAuth client IDs:
   - Android client ID for package `mt.marketplace.craftsman`
   - Web client ID for Expo Auth Session / backend audience validation
   - iOS client ID later for TestFlight/App Store, bundle identifier `mt.marketplace.craftsman`
5. For Android, add SHA fingerprints:
   - Google Play App Signing SHA-1/SHA-256 for Play builds
   - EAS/keystore SHA-1/SHA-256 for internal builds if needed
6. Add the generated client IDs to:
   - Backend env: `GOOGLE_ANDROID_CLIENT_ID`, `GOOGLE_WEB_CLIENT_ID`
   - Mobile env: `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

If you have more than one valid client ID, put comma-separated IDs in `GOOGLE_ALLOWED_CLIENT_IDS`.

## Resend Setup

1. Create a Resend account.
2. Add and verify your sending domain.
3. Configure DNS records that Resend gives you, including SPF/DKIM.
4. Create a Resend API key.
5. Set:

```env
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=MaltaPro <hello@yourdomain.com>
APP_PUBLIC_URL=https://your-public-frontend-or-landing-page.example.com
MOBILE_DEEP_LINK_SCHEME=maltapro
```

Verification links use:

```text
maltapro://verify-email?token=...
maltapro://reset-password?token=...
```

The email also includes a web fallback using `APP_PUBLIC_URL`.

## EAS Build Notes

The app scheme is already configured as:

```text
maltapro
```

Use production builds for real Google OAuth testing:

```bash
cd apps/mobile
npx eas-cli@latest build --platform android --profile production
```

Preview builds can use a staging or ngrok API URL:

```bash
cd apps/mobile
npx eas-cli@latest build --platform android --profile preview
```

Expo Go is useful for layout checks, but production Google auth, push notifications, and native behavior should be tested with an EAS build.

## Owner Test Checklist

Run these after deploying the API and building the app:

1. Register with email/password.
2. Confirm profile shows "Email not verified".
3. Receive verification email.
4. Open the verification link.
5. Confirm profile shows "Email verified".
6. Press resend verification from Profile for an unverified account.
7. Open Login, press "Forgot your password?".
8. Submit email and receive reset email.
9. Open reset link and set a new password.
10. Confirm old refresh session is invalidated by logging in again.
11. Continue with Google as a new employer.
12. Continue with Google as a new contractor.
13. Continue with Google for an existing email/password email to link the account.
14. Suspend a user in admin and confirm they cannot log in.

## Smoke Test

Start the API locally first:

```bash
npm run api:dev
```

In another terminal:

```bash
npm run smoke:auth-google-resend --workspace @malta-marketplace/api
```

For smoke testing without real email delivery, run the API with:

```env
AUTH_EMAIL_DEBUG_TOKENS=true
AUTH_EMAIL_DELIVERY_DISABLED=true
```

The smoke test uses mock Google tokens and debug email/reset tokens. It should not send real Resend emails.

## Production Notes

- Set `AUTH_EMAIL_DEBUG_TOKENS=false` in production.
- Set `AUTH_EMAIL_DELIVERY_DISABLED=false` in production.
- Keep `RESEND_API_KEY` only on the backend.
- Keep Google client secrets out of the app.
- Publish the Google OAuth consent screen before production release if Google requires it.
- Test deep links on an installed EAS build.
- Use Play Console app signing SHA fingerprints for Google Android OAuth when testing the Play-distributed build.
