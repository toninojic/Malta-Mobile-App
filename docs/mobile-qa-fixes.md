# Mobile QA Fixes

## Auth Gate

Unverified email/password users now see only the Verify Email Required screen.

QA checklist:

- register with email/password
- confirm app shows `Verify your email`
- confirm Jobs, Activity, Messages, Alerts, Wallet, Profile, and AI assistant are not reachable
- tap `Resend verification email`
- open verification email link
- tap `I verified my email`
- confirm app enters the normal experience

If an API bypass is attempted, backend returns `EMAIL_NOT_VERIFIED`.

## Google OAuth

Android and iOS Google OAuth use the native `@react-native-google-signin/google-signin` SDK. The native flow opens Google's account chooser directly and does not use Chrome, Expo AuthSession proxy, `openBrowserAsync`, or a custom-scheme redirect.

Expected diagnostics:

```text
[google-button] pressed
[google-button] role selected
[google-button] terms accepted
[google-button] request ready
[google-button] promptAsync exists
[google-auth] native: configured
[google-auth] native: signIn started
[google-auth] native: signIn result (type=success, hasIdToken=true)
[google-auth] useProxy: false
[google-auth] backend response status: 200
```

The ID token is requested for `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and is sent to `POST /api/v1/auth/google`. The Android OAuth client still must match package `mt.marketplace.craftsman` and the certificate SHA-1 used to sign the installed build.

Google login and Google registration use the same native identity flow. Registration still sends the selected role plus Terms/Privacy consent; login sends only the ID token.

The Google buttons show a visible error when auth is not configured, Terms/Privacy consent is missing, Google Play Services are unavailable, or Google reports a package/SHA/client mismatch. Production EAS builds fail early if the Android or Web Google client ID is missing.

`DEVELOPER_ERROR` or native error code `10` means the Android OAuth client does not match the installed package/signing certificate. Verify both the Google Play App Signing SHA-1 and the EAS/upload SHA-1 as appropriate.

This native SDK addition requires a new EAS build with cache cleared. An EAS Update cannot add the native module. Google Sign-In is intentionally unavailable in Expo Go.

Expo web keeps a separate direct Web OAuth/AuthSession flow. Its exact generated HTTPS redirect URI must be registered on the Web OAuth client if web Google login is tested.

Enable `EXPO_PUBLIC_AUTH_DEBUG=true` temporarily and check:

```text
[google-auth] native signIn failed { code, message }
```

Diagnostics never print the Google ID token.

## Account Deactivation And Google Re-Registration

User-requested account deactivation is stored separately from an admin suspension. A user who deactivated their own account can restore the same account through a valid email/password login, Google login, or registration with the original role. Existing marketplace history remains attached to the same user ID.

Admin-suspended accounts cannot use login or registration to reactivate themselves. Google registration with a different role also remains blocked and tells the user which original role to select.

The API includes legacy compatibility for Google accounts deactivated before the separate timestamp existed, but only when no admin suspension audit or suspension notification exists.

Each Google button press now handles its own result directly instead of reusing a response through a screen effect. Backend auth failures sign out only the local Google SDK session, so the next press starts cleanly and can select another Google account. Public login/register requests also skip refresh-token retry, preventing an old MaltaPro session from interfering with a new auth attempt.

Concurrent first-time Google requests resolve through an email upsert, while separate Google-ID and email lookups reject identity conflicts instead of selecting an arbitrary user.

## Phone Country Code Selector

Registration and Profile use a country selector with Malta `+356` selected by default.

QA checklist:

- default country is Malta
- selecting Serbia, UK, Italy, or another listed country updates the dial code
- saving stores a full normalized number such as `+35699123456`
- existing saved full numbers are parsed back into country code plus local number

## Offer Start Date Picker

Offer create/edit uses a date picker for `When can you start?`.

QA checklist:

- tapping the field opens the date picker
- keyboard does not open
- past dates are disabled
- selected date displays as `DD/MM/YYYY`
- offer create/edit submits successfully with a valid ISO date
