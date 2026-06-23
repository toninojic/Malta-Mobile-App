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

Android Google OAuth uses Expo AuthSession proxy flow.

Expected diagnostics:

```text
[google-button] pressed
[google-button] role selected
[google-button] terms accepted
[google-button] request ready
[google-button] promptAsync exists
[google-auth] redirectUri: https://auth.expo.io/@toninojic/malta-craftsman-marketplace
[google-auth] useProxy: false
[google-auth] auth result type: success
[google-auth] has idToken: true
[google-auth] backend response status: 200
```

No Google request should send `maltapro://` as the Google `redirect_uri`.

The native return URL remains `maltapro://redirect`, but it is used only after the Expo proxy receives the Google response.

The Google buttons now show a visible error when auth is not configured, still loading, missing Terms/Privacy consent, or unable to open the auth session. Production EAS builds fail early if the Android or Web Google client ID is missing.

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
