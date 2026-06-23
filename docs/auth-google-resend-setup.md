# Google Auth And Email Setup

This is the MaltaPro production setup for Google Sign-In and email auth fallback pages.

## OAuth Flow Used

MaltaPro Android builds use Expo AuthSession with the Expo proxy redirect:

```text
https://auth.expo.io/@toninojic/malta-craftsman-marketplace
```

The app opens Google through the proxy and returns to the native app with:

```text
maltapro://redirect
```

Important:

- Google receives the HTTPS Expo proxy redirect URI.
- Google must not receive `maltapro://` as the OAuth `redirect_uri`.
- The returned ID token has the Web OAuth client ID as its audience.
- The backend must allow that Web client ID.

## Android Browser Handling

The app declares Android package visibility queries for:

```text
android.intent.action.VIEW http
android.intent.action.VIEW https
android.support.customtabs.action.CustomTabsService
```

These queries are required on Android 11+ so `expo-web-browser` can discover Chrome or another browser/custom-tabs provider.

The app scheme is:

```text
maltapro
```

The Android build also has a `maltapro://` VIEW intent filter so the AuthSession return URL can reopen MaltaPro.

Changing these native settings requires a new EAS build, not only an EAS Update:

```bash
npx eas-cli@latest build --platform android --profile production --clear-cache
```

## Google Cloud Console

Android OAuth Client:

```text
Application type: Android
Package name: mt.marketplace.craftsman
SHA-1: Google Play App Signing SHA-1 for production/internal testing
```

Web OAuth Client:

```text
Application type: Web application
Authorized redirect URI:
https://auth.expo.io/@toninojic/malta-craftsman-marketplace
```

Authorized JavaScript origins:

```text
https://maltaproapp.online
https://maltapro-api.onrender.com
```

If the OAuth consent screen is in Testing mode, add every tester Gmail address.

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

`GOOGLE_ALLOWED_CLIENT_IDS` is optional. Use it only when you need to allow additional client IDs.

## Mobile Environment

Required in EAS production:

```env
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<android-oauth-client-id>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web-oauth-client-id>
EXPO_PUBLIC_API_URL=https://maltapro-api.onrender.com/api/v1
EXPO_PUBLIC_AUTH_DEBUG=false
```

Use `EXPO_PUBLIC_AUTH_DEBUG=true` only for temporary QA builds because it prints safe diagnostic state to the device logs.

## Email Verification And Reset Fallback

Email buttons should use HTTPS links, not custom app links:

```text
https://maltaproapp.online/verify-email?token=...
https://maltaproapp.online/reset-password?token=...
```

The public site should handle these routes and call the backend verification/reset endpoints. The email body should also include a plain fallback URL for copy/paste.
