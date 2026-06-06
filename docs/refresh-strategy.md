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
- Alerts and unread alert counts: poll every 30 seconds while focused/enabled.
- Activity summary: refetches on focus only when stale and supports manual pull-to-refresh.
- Jobs, offers, contacts, reviews, wallet, and admin lists do not use aggressive polling. They refetch on focus and after relevant mutations.

## Focus Refetch Rules

- Alerts refetch on screen focus and app resume.
- Conversation list refetches on screen focus and app resume.
- Conversation thread refetches on screen focus and app resume, then continues the 3 second focused poll.
- Activity refetches on screen focus and app resume.
- Employer jobs, contractor job browse, job details, my offers, Offer / Work Details, contact unlock, contacts, contact details, reviews, and wallet refetch on screen focus.
- Wallet package, balance, transaction, refund, payment, and payment-config queries refetch on wallet focus and app resume.
- Manual pull-to-refresh remains available where it already existed; it is a fallback, not the primary sync mechanism.

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
- Create, update, withdraw, or select offer: cache the changed offer, invalidate job details, job offers, my offers, work details, activity, contacts, messages, and notifications.
- Select offer: immediately updates the visible job detail status to `IN_PROGRESS` before refetching server state.
- Unlock contact or request contact: invalidate contact details, unlock status, offers, jobs, activity, notifications, messages, and token state when tokens changed.
- Mark completed or confirm completion: invalidate contact details, completion status, reviews, jobs, offers, activity, notifications, and messages.
- Create or reply to review: invalidate review details, contractor review summary, contact completion status, activity, notifications, jobs, and offers.
- Send message: append the returned message locally, then invalidate the conversation thread, conversation list, notifications, and activity.
- Create conversation: invalidate the conversation list, conversation thread, and activity.
- Mark message read: update the thread message locally, then invalidate conversation list, unread alert count, and activity.
- Purchases/refunds: invalidate only token, payment, refund, notification, admin statistics, and audit-log keys needed by the action.

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
- Contractor sees selected offers in My Offers/Work Details on focus without manual refresh.
- Contractor unlocks contact and contact/activity/token state refreshes.
- Contractor marks completed and employer contact details/activity reflect pending confirmation.
- Employer confirms completion and completed/review states refresh.
- Employer leaves a review and contractor review screens/activity refresh.
- Conversation thread receives new messages through 3 second polling.
- Conversation list updates while focused through 20-30 second polling.
- Alerts and unread counts update through 12 second polling.
- No screen requires app restart, tab cycling, or manual refresh for server data that already exists.
