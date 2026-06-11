# Refresh Strategy

This document describes the MVP refresh and synchronization rules used by the mobile app. The goal is near real-time UX without WebSockets, broad global refetching, or aggressive polling.

## React Query Defaults

- Global query defaults keep a 30 second `staleTime`, 5 minute `gcTime`, retry twice, and do not retry 429 responses.
- React Query focus is wired to React Native `AppState`, so app resume can trigger `refetchOnWindowFocus` queries.
- Domain hooks opt into `refetchOnWindowFocus` where server-side changes are user-visible.
- Polling uses `refetchIntervalInBackground: false` so polling pauses when the app is not active.

## Polling Rules

- Conversation thread: polls every 3 seconds while the thread screen is focused.
- Conversation list: polls every 25 seconds while the user conversation list is focused.
- Admin conversation list: polls every 30 seconds while the admin conversation list is focused.
- Alerts and unread alert counts: poll every 12 seconds while focused/enabled and exclude `NEW_MESSAGE`.
- Activity summary: refetches on focus only when stale and supports manual pull-to-refresh.
- Jobs, offers, contacts, reviews, wallet, and admin lists do not use aggressive polling. They refetch on focus and after relevant mutations.

## Focus Refetch Rules

- Alerts refetch on screen focus and app resume.
- Conversation list refetches on screen focus and app resume.
- Conversation thread refetches on screen focus and app resume, then continues the 3 second focused poll.
- Activity refetches on screen focus and app resume.
- Employer jobs, contractor job browse, job details, my offers, Offer / Work Details, contact unlock, contacts, contact details, reviews, and wallet refetch on screen focus.
- Wallet package, balance, transaction, refund, payment, and payment-config queries refetch on wallet focus and app resume.
- Manual pull-to-refresh is available on jobs, job details, Activity, My Offers, Offer / Work Details, wallet, alerts, messages list, chat thread, profile, contractor profile, contacts, contact details, and primary admin list/detail screens. It triggers one controlled refetch per query and skips duplicate in-flight refetches where the screen owns multiple queries.

## Query Invalidation Rules

Mutation side effects must invalidate only the affected query families:

- Activity: `['activity', 'summary']`
- Notifications: `['notifications']`
- Jobs: `['jobs']`, `['jobs', jobId]`, `['jobs', 'mine']`, `['jobs', 'browse', filters]`
- Offers: `['offers']`, `['offers', 'job', jobId]`, `['offers', 'mine']`, `['offers', 'work-details', offerId]`
- Contacts: `['contacts']`, `['contacts', 'mine']`, `['contacts', 'details', contactId]`, `['contacts', 'unlock-status', offerId]`
- Completion and reviews: `['reviews']`, `['reviews', 'completion-status', contactId]`, `['reviews', 'details', reviewId]`, contractor review and rating-summary keys
- Messages: `['messages', 'conversations']`, `['messages', 'conversation', conversationId]`
- Wallet: token balance, transactions, refunds, payments, and admin refund queues
- Admin: statistics, audit logs, moderation lists, and admin domain lists only when an admin mutation is involved

The shared `invalidateMarketplaceState` helper centralizes marketplace invalidations. Direct wallet/admin/notification/message invalidations use the same diagnostic wrapper.

## Mutation Update Rules

- Create or update job: cache the job detail, invalidate jobs, activity, notifications, offers, contacts, and conversations as needed.
- Create, update, withdraw, reject, cancel selection, or select offer: cache the changed offer, invalidate job details, job offers, my offers, work details, activity, contacts, messages, and notifications.
- Select offer: immediately updates the visible job detail status to `IN_PROGRESS` before refetching server state. The backend rejects all other pending offers for the same job, so offer lists and My Offers must be invalidated together.
- Cancel selection: updates the visible job detail status back to `ACTIVE`, invalidates browse jobs, job details, job offers, My Offers, Activity, contacts, and notifications.
- Unlock contact or request contact: invalidate contact details, unlock status, offers, jobs, activity, notifications, messages, and token state when tokens changed.
- Mark completed or confirm completion: invalidate contact details, completion status, reviews, jobs, offers, activity, notifications, and messages.
- Create or reply to review: invalidate review details, contractor/employer review summaries, contact completion status, activity, notifications, jobs, and offers.
- Contractor employer review: invalidate `['employers', employerId, 'reviews']`, `['employers', employerId, 'rating-summary']`, work details, completion status, Activity, and notifications.
- Send message: append the returned message locally, then invalidate the conversation thread, conversation list, notifications, and activity.
- Create conversation: invalidate the conversation list, conversation thread, and activity.
- Mark message read: update the thread message locally, then invalidate conversation list, unread alert count, and activity.
- Purchases/refunds: invalidate only token, payment, refund, notification, admin statistics, and audit-log keys needed by the action. Wallet purchase mode is driven by `/payments/config`; mock mode uses `/tokens/mock-purchase` and refreshes wallet balance immediately, while Stripe mode uses checkout only when Stripe is configured.
- Contractor profile access: after contact unlock, profile queries under `['contractors', contractorId, 'profile']` are invalidated with contractor review/rating keys so employers can see newly available contact details without app restart.

## Diagnostics

In development diagnostics mode, invalidations log messages such as:

```text
Query invalidated: activity-summary
Query invalidated: job-details:<jobId>
Query invalidated: notifications
Query invalidated: conversation-thread:<conversationId>
```

Diagnostics are gated by the existing API diagnostics config and are not verbose in production.

## QA Checklist

- Employer creates a job, returns to the jobs list, and sees it without manual reload.
- Contractor submits an offer, returns to offers/activity, and sees updated counts.
- Employer selects an offer and the job detail status changes to `IN_PROGRESS` immediately.
- Other pending offers on that job refresh to `REJECTED` after one offer is selected.
- Employer cancels selection before unlock and the job detail status changes back to `ACTIVE`; contractor browse can find the job again.
- Contractor sees selected offers in My Offers/Work Details on focus without manual refresh.
- Contractor unlocks contact and contact/activity/token state refreshes.
- Employer opens the contractor profile after unlock and sees full contact/profile details; before unlock, private contact details stay hidden.
- Contractor marks completed and employer contact details/activity reflect pending confirmation.
- Employer confirms completion and completed/review states refresh.
- Employer leaves a review and contractor review screens/activity refresh.
- Contractor leaves an employer review after confirmed completion and employer rating screens/activity refresh.
- Employer My Reviews badge counts jobs waiting for review plus unread review-related notifications, then clears after review submission/read state refresh.
- Conversation thread receives new messages through 3 second polling.
- Conversation list updates while focused through 20-30 second polling.
- Alerts and unread counts update through 12 second polling and do not include `NEW_MESSAGE`; message unread state remains in Messages.
- No screen requires app restart, tab cycling, or manual refresh for server data that already exists.
