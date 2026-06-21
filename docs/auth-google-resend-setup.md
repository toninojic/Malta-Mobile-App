# Google OAuth Setup For MaltaPro

This app uses native Google OAuth for EAS and Google Play builds.

## Google Play Internal Testing / Production

Use the native Expo scheme redirect. Do not use the Expo proxy URL for production builds.

- Expo owner: `toninojic`
- Expo slug: `malta-craftsman-marketplace`
- App scheme: `maltapro`
- Android package: `mt.marketplace.craftsman`
- Native redirect URI used by the app: `maltapro://redirect`
- Backend endpoint: `POST https://maltapro-api.onrender.com/api/v1/auth/google`

Do not configure production builds to rely on:

```txt
https://auth.expo.io/@toninojic/malta-craftsman-marketplace
```

That proxy URL is only for explicit Expo Go/proxy testing flows. Google Play Internal Testing and standalone EAS builds must use the native redirect.

## Google Cloud OAuth Clients

Create or verify these OAuth clients in Google Cloud Console:

1. Android OAuth client
   - Package name: `mt.marketplace.craftsman`
   - SHA-1 certificate fingerprint: use the Google Play App Signing SHA-1 from Play Console for the uploaded app.
   - Put this client ID in `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`.

2. Web OAuth client
   - Used by Expo AuthSession during token exchange and web/dev flows.
   - Put this client ID in `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.

Do not swap the Android and Web client IDs.

## OAuth Consent Screen

While the Google OAuth app is in Testing mode:

- Add every tester Gmail address to OAuth consent screen test users.
- Include `openid`, `email`, and `profile` scopes.
- Publish the OAuth app when ready for public production use.

## EAS Environment Variables

Set these for production EAS builds:

```env
EXPO_PUBLIC_API_URL=https://maltapro-api.onrender.com/api/v1
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

If iOS is configured later, add:

```env
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
```

After changing any `EXPO_PUBLIC_GOOGLE_*` value, rebuild the EAS app. These values are compiled into the native build.

## Expected Runtime Behavior

In a Google Play Internal Testing build:

1. User taps Continue with Google.
2. App opens Google OAuth with redirect URI `maltapro://redirect`.
3. Expo proxy is not used.
4. Google returns an ID token.
5. The mobile app sends:

```json
{
  "idToken": "...",
  "role": "EMPLOYER or CONTRACTOR",
  "termsAccepted": true,
  "privacyAccepted": true
}
```

for first-time registration, or only:

```json
{
  "idToken": "..."
}
```

for existing-user login.

The app logs safe development diagnostics only. It never logs `idToken` or `accessToken`.

## Email Verification Deep Link

Verification emails use:

```text
maltapro://verify-email?token=...
```

The mobile app routes this to the Verify Email screen, calls:

```http
POST /api/v1/auth/verify-email
```

and then shows a success or invalid/expired token state.

Configure the public web fallback with:

```env
APP_PUBLIC_URL=https://maltaproapp.online
AUTH_WEB_FALLBACK_URL=https://maltaproapp.online
MOBILE_DEEP_LINK_SCHEME=maltapro
```

The fallback URL is:

```text
https://maltaproapp.online/verify-email?token=...
```

The public site should either redirect users to the app deep link or show a clear instruction to open MaltaPro.

The API also supports a direct HTML fallback:

```text
https://maltapro-api.onrender.com/api/v1/auth/verify-email?token=...
```

Use this as `AUTH_WEB_FALLBACK_URL` if the public website verification page is not ready yet.
