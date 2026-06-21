# Google OAuth And Resend Setup

This guide is for MaltaPro owner setup and QA.

## Google OAuth

The mobile app currently uses the Expo AuthSession proxy ID-token flow because the Google Web OAuth client is configured with this redirect URI:

```text
https://auth.expo.io/@toninojic/malta-craftsman-marketplace
```

In Google Cloud Console, the Web OAuth client must include that exact value under **Authorized redirect URIs**. Keep these values aligned:

```text
Expo owner: toninojic
Expo slug: malta-craftsman-marketplace
App scheme: maltapro
Android package: mt.marketplace.craftsman
```

Mobile env:

```env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
EXPO_PUBLIC_AUTH_DEBUG=true
```

Backend env:

```env
GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
GOOGLE_ALLOWED_CLIENT_IDS=your-web-client-id.apps.googleusercontent.com,your-android-client-id.apps.googleusercontent.com
```

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

They show platform, redirect URI, whether client IDs are present, response type, and whether an ID token was returned.

If Google still shows `400 invalid_request`, verify:

- the redirect URI is exactly `https://auth.expo.io/@toninojic/malta-craftsman-marketplace`
- the mobile build/update contains the correct `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- the Web client ID is not swapped with the Android client ID
- the OAuth consent screen includes tester Gmail accounts while Google app publishing status is Testing
- the backend allows the same Web client ID in `GOOGLE_WEB_CLIENT_ID` or `GOOGLE_ALLOWED_CLIENT_IDS`

After changing `EXPO_PUBLIC_GOOGLE_*` values, publish an EAS Update or create a new EAS build so the installed app receives the new public config.

## Email Verification And Password Reset

Email action buttons use HTTPS links first, then show the app deep link as fallback text.

Backend env:

```env
APP_PUBLIC_URL=https://maltaproapp.online
MOBILE_DEEP_LINK_SCHEME=maltapro
RESEND_API_KEY=your-resend-key
RESEND_FROM_EMAIL=MaltaPro <your-verified-sender@your-domain.com>
```

Verification email button:

```text
https://maltaproapp.online/verify-email?token=TOKEN
```

Password reset email button:

```text
https://maltaproapp.online/reset-password?token=TOKEN
```

Fallback app links:

```text
maltapro://verify-email?token=TOKEN
maltapro://reset-password?token=TOKEN
```

If `APP_PUBLIC_URL` or `AUTH_WEB_FALLBACK_URL` is missing, the API logs a clear error and falls back to the app deep link instead of creating an undefined button URL.
