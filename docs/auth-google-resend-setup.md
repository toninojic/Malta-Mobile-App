# Google Auth And Email Setup

This is the MaltaPro production setup for Google Sign-In and email auth fallback pages.

## Native Google Sign-In Flow

MaltaPro Android and iOS builds use `@react-native-google-signin/google-signin`.

On Android the flow is:

```text
GoogleSignin.configure(webClientId)
GoogleSignin.hasPlayServices()
GoogleSignin.signIn()
ID token -> POST /api/v1/auth/google
```

The native app does not open Chrome and does not use the Expo AuthSession proxy. There is no Google OAuth redirect URI such as `maltapro://redirect` in the Android request. The `maltapro` scheme remains available for MaltaPro application deep links.

The ID token audience is the Web OAuth client ID. The backend must include that same client ID in its allowed Google audiences.

Expo Go cannot load this native SDK. Test Google login with a development, preview, or production EAS build.

## Google Cloud Console

Create or keep both OAuth clients in the same Google Cloud/Firebase project.

Android OAuth client:

```text
Application type: Android
Package name: mt.marketplace.craftsman
SHA-1: Google Play App Signing SHA-1 for Internal Testing/production installs
```

Also register the EAS/upload certificate SHA-1 when testing an APK installed directly rather than through Google Play.

Web OAuth client:

```text
Application type: Web application
Used as EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and GOOGLE_WEB_CLIENT_ID
```

Native Android login does not require an `https://auth.expo.io/...` authorized redirect URI. If Expo web Google login is tested, add the exact redirect URI printed by `[google-auth] redirectUri` and the matching web origin to the Web OAuth client.

If the OAuth consent screen is in Testing mode, add every tester Gmail address.

After changing Firebase Android app fingerprints, download a fresh `google-services.json`, encode/store it in the existing EAS secret setup, and create a new EAS build.

## Backend Environment

Required in Render production:

```env
GOOGLE_ANDROID_CLIENT_ID=<android-oauth-client-id>
GOOGLE_WEB_CLIENT_ID=<web-oauth-client-id>
GOOGLE_ALLOWED_CLIENT_IDS=
APP_PUBLIC_URL=https://maltaproapp.online
MOBILE_DEEP_LINK_SCHEME=maltapro
AUTH_ALLOW_MOCK_GOOGLE=false
AUTH_EMAIL_DEBUG_TOKENS=false
AUTH_EMAIL_DELIVERY_DISABLED=false
```

`GOOGLE_ALLOWED_CLIENT_IDS` is optional. Use it only for additional valid client IDs.

## Mobile Environment

Required in EAS production:

```env
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<android-oauth-client-id>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web-oauth-client-id>
EXPO_PUBLIC_API_URL=https://maltapro-api.onrender.com/api/v1
EXPO_PUBLIC_AUTH_DEBUG=false
```

Use `EXPO_PUBLIC_AUTH_DEBUG=true` only temporarily. It logs native method, result type, and safe error code/message, but never the ID token.

## Build And Test

Because Google Sign-In is a native dependency, create a new build:

```bash
npm run eas -- build --platform android --profile production --clear-cache
```

The Expo app version is `0.1.1`, giving this native build a new EAS runtime version so older binaries cannot receive an incompatible Google Sign-In update.

Upload the generated AAB to Google Play Internal Testing, install it from Google Play, and test both:

```text
Login -> Continue with Google
Register -> accept Terms/Privacy -> Continue with Google
```

An EAS Update alone is not sufficient for the first build containing the native SDK.

## Email Verification And Reset Fallback

Email buttons use HTTPS links:

```text
https://maltaproapp.online/verify-email?token=...
https://maltaproapp.online/reset-password?token=...
```

The public routes call the backend verification/reset endpoints. The emails also contain the full HTTPS fallback URL for copy/paste.
