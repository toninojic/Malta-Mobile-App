# Google OAuth And Resend Setup

This guide is for MaltaPro owner setup and QA.

## Google OAuth

For Google Play Internal Testing and production EAS Android builds, MaltaPro uses the native Android Google OAuth client.

Do not use a Web OAuth client with a custom scheme redirect such as:

```text
maltapro://
maltapro://redirect
maltapro://auth
```

Google rejects that combination with:

```text
custom scheme URIs are not allowed for WEB client type
```

## Android OAuth Client

In Google Cloud Console create/use an **Android** OAuth client with:

```text
Package name: mt.marketplace.craftsman
SHA-1: Google Play App Signing SHA-1 for the uploaded app
```

Mobile env:

```env
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_AUTH_DEBUG=true
```

Backend env:

```env
GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
GOOGLE_ALLOWED_CLIENT_IDS=your-android-client-id.apps.googleusercontent.com,your-web-client-id.apps.googleusercontent.com
```

The Android app lets `expo-auth-session/providers/google` generate the native redirect URI and select `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` on Android.

The app requests:

```text
openid email profile
```

and sends the returned ID token to:

```http
POST /api/v1/auth/google
```

Do not log ID tokens or access tokens.

Temporary safe diagnostics are logged with the prefix:

```text
[google-auth]
```

They show platform, generated redirect URI, selected client ID masked, response type, client IDs present, and whether an ID token was returned.

After changing `EXPO_PUBLIC_GOOGLE_*` values, publish an EAS Update or create a new EAS build so the installed app receives the new public config. If the Android OAuth client SHA-1 or native app config changed, create a new EAS build.

## Expo Proxy Note

The old Expo proxy redirect URI is:

```text
https://auth.expo.io/@toninojic/malta-craftsman-marketplace
```

That URI is valid only for an Expo proxy/Web-client flow. It must not be mixed with native custom scheme redirects. The Google Play build should use the Android OAuth client instead.

## Email Verification And Password Reset

Email action buttons use HTTPS links first. Custom app links are shown only as fallback text because many email clients block custom schemes in buttons.

Backend env:

```env
APP_BASE_URL=https://maltapro-api.onrender.com/api/v1
AUTH_WEB_FALLBACK_URL=https://maltapro-api.onrender.com/api/v1/auth
APP_PUBLIC_URL=https://maltaproapp.online
MOBILE_DEEP_LINK_SCHEME=maltapro
RESEND_API_KEY=your-resend-key
RESEND_FROM_EMAIL=MaltaPro <your-verified-sender@your-domain.com>
```

`AUTH_WEB_FALLBACK_URL` is optional but recommended. If it is missing, the API derives the auth page base from `APP_BASE_URL`.

Verification email button:

```text
https://maltapro-api.onrender.com/api/v1/auth/verify-email?token=TOKEN
```

The API also supports a short redirect route:

```text
https://maltapro-api.onrender.com/verify-email?token=TOKEN
```

Password reset email button:

```text
https://maltapro-api.onrender.com/api/v1/auth/reset-password?token=TOKEN
```

The API also supports a short redirect route:

```text
https://maltapro-api.onrender.com/reset-password?token=TOKEN
```

Verification behavior:

- reads the token from query string
- verifies it on the backend
- shows success or invalid/expired state
- offers an `Open MaltaPro` app link

Password reset behavior:

- reads the token from query string
- shows a password form
- submits to `POST /api/v1/auth/reset-password`
- shows success or invalid/expired state
- offers an `Open MaltaPro` app link after success

Fallback app links:

```text
maltapro://verify-email?token=TOKEN
maltapro://reset-password?token=TOKEN
```

If you later create real pages on `https://maltaproapp.online/verify-email` and `https://maltaproapp.online/reset-password`, set:

```env
AUTH_WEB_FALLBACK_URL=https://maltaproapp.online
```

Until those public-site routes exist, do not use `APP_PUBLIC_URL` as the primary auth email link because the WordPress/frontpage route will swallow the token page.
