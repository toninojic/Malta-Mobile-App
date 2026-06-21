# Mobile QA Fixes

## Final Pre-Launch Fixes

- Added first-party product analytics with fire-and-forget mobile tracking.
- Added admin analytics overview, funnels, and friction/error cards to the admin dashboard.
- Added Android notification small icon asset at `apps/mobile/assets/notification-icon.png`.
- Configured `expo-notifications` with notification icon and brand color `#ED3A35`.
- Email verification links use the MaltaPro scheme `maltapro://verify-email?token=...`.
- Backend supports direct HTML verification fallback at `/api/v1/auth/verify-email?token=...`.
- Verify Email screen now automatically verifies deep-link tokens and shows clear verifying/success/error states.
- Offer selection cancellation restores offers rejected with `AUTO_REJECTED_BY_SELECTION` back to `PENDING`.
- Manually rejected offers remain rejected after selection cancellation.
- Job close moderation can mark affected pending/auto-rejected offers with `JOB_CLOSED`.

## QA Commands

```bash
npm run smoke:analytics --workspace @malta-marketplace/api
npm run smoke:final-prelaunch-fixes --workspace @malta-marketplace/api
```
