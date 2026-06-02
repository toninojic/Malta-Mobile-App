# Mobile QA Fixes

This QA sprint fixes mobile UX regressions without adding a new milestone or new product scope.

## What Changed

- Chat uses a keyboard-aware message thread layout. The composer stays above the keyboard and the list scrolls to the latest message.
- Employer and contractor profiles can upload an avatar from the device. The backend stores avatars locally under `uploads/avatars` and updates `profile.avatarUrl`.
- Job create/edit validation now shows field-level errors for title, description, category, subcategory, and location.
- Job images can be opened in a fullscreen viewer with swipe paging and an image counter.
- Contractor Activity badge is derived from actionable Activity counts instead of marking notifications read on tab open.
- Activity cards route to filtered empty states instead of unrelated generic lists.
- Completed contractor offers hide edit, withdraw, and unlock actions.
- My Offers uses compact icon actions for view, edit, message, unlock, and withdraw.
- Category/subcategory selection uses a shared expanded service list and validates combinations on the backend.
- Wallet reads `/payments/config` and uses mock purchase only when `ALLOW_MOCK_PURCHASES=true`.

## Backend QA

Run with the API available:

```bash
npm run smoke:qa-mobile-ux --workspace @malta-marketplace/api
```

The smoke test checks:

- protected profile access
- job validation messages
- category/subcategory pairing
- contractor job-create protection
- avatar upload and file type validation
- token package seed data
- payment config
- mock purchase when enabled
- Stripe missing-config message when mock mode is disabled and Stripe is not configured

## API Refresh Strategy And Throttling

React Query defaults are tuned for mobile:

- query data is stale after 30 seconds
- inactive query data stays cached for 5 minutes
- screen focus is used for useful refetches
- global window-focus refetch is disabled
- 429 responses are not retried
- mutations do not retry automatically

Screen refresh behavior:

- Activity calls one lightweight `/activity/summary` endpoint, refetches on focus only when the last successful fetch is older than 30 seconds, and supports pull-to-refresh.
- Activity does not automatically call `/notifications/read-all` when the tab opens.
- Contractor Activity badge is derived from actionable `/activity/summary` counts instead of unread notifications. Employer Alerts still use notification unread count.
- Jobs fetch on focus only when stale, support pull-to-refresh, and do not poll automatically.
- Job filters are applied only when the user taps Apply; expanding category accordions does not call the API.
- Conversation threads poll every 3 seconds only while the thread is focused.
- Conversation lists poll every 25-30 seconds only while the Messages screen is focused.
- Alerts poll every 30 seconds only while the Alerts screen is focused.
- Wallet does not poll; it refetches when focused and after purchase/refund mutations.

Backend throttling remains enabled. Route-level limits separate strict auth/write endpoints from more tolerant read/list endpoints such as jobs, contacts, conversations, notifications, token wallet reads, and activity summary.

When the API returns 429, the mobile client shows:

```text
Too many refreshes. Please wait a moment.
```

Background refreshes keep previous React Query data visible and do not enter retry loops.

## Status Refresh And Conversation Navigation Rules

Mutation refresh is targeted by product area, not global:

- job create, edit, renew, close, and admin close refresh job lists, job details, related offers, Activity, notifications, and admin job/statistic views when relevant
- offer create, edit, withdraw, and select refresh offers, My Offers, job details/lists, contacts, Activity, and notifications
- contact request and unlock refresh contacts, unlock status, related offers, Activity, notifications, and token wallet state when a token is spent
- completion and review actions refresh contacts, completion status, jobs, offers, contractor rating/review summaries, Activity, and notifications
- conversation creation, sending messages, and message read status refresh conversation lists, the active message thread, Activity, and notification badges
- notification read actions refresh notifications, unread counts, Activity, and conversation badges only
- token purchase/refund actions refresh wallet, payments, refunds, admin statistics, audit logs, and refund notifications

The Messages tab always opens the conversation list. It never auto-opens the latest or only thread. Chat CTAs from a job, offer, unlock, or contact detail open the specific conversation returned by the backend.

Conversation list cards show the job title, participant names, contact status, last message preview, unread count, and last activity time. Conversation threads keep existing messages visible during background refetches, poll every 3 seconds only while focused, append sent messages locally without duplicates, and then refetch the active thread/list for server-confirmed state.

## Manual Mobile QA

1. Login as contractor and open Activity. The Activity badge should match selected/in-progress counts and should not call `/notifications/read-all`.
2. Open Selected Offers with no selected offers. It should show an empty state, not the full offers list.
3. Open Jobs In Progress with no active unlocked jobs. It should show an in-progress empty state.
4. Open a chat and type while the keyboard is visible. The composer should remain visible.
5. Edit profile and choose an avatar image. The image should preview before save and persist after save.
6. Try creating a job with a short title or description. Field errors should appear on the form.
7. Open a job image. It should show fullscreen with swipe navigation and a counter.
8. Complete an offer flow and confirm the offer card no longer shows edit, withdraw, or unlock actions.
9. Open Activity several times. It should call `/activity/summary`, not separate jobs/offers/contacts/reviews lists.
10. Re-enter Activity within 30 seconds. It should not call `/activity/summary` again unless you pull-to-refresh.
11. Opening Activity should not call `/notifications/read-all`; that endpoint is only used from the Notifications screen manual Read All action.
12. Open Jobs and expand/collapse Filters repeatedly. No job browse request should fire until Apply or Clear is pressed.
