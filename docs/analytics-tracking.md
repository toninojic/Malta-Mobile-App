# MaltaPro Analytics Tracking

MaltaPro uses first-party product analytics stored in the API database. This is not GA4 and does not send user behavior to an external analytics provider.

## What Is Tracked

Analytics events are stored as:

- `sessionId`
- `userId` when authenticated
- `role`
- `eventName`
- `screen`
- optional `entityType`
- optional `entityId`
- sanitized `metadata`
- `platform`
- `appVersion`
- `createdAt`

Sensitive text is not stored. Metadata keys such as `message`, `body`, `description`, `content`, `phone`, `email`, `token`, `url`, `document`, and similar fields are redacted.

## API

Mobile can send:

```http
POST /api/v1/analytics/events
POST /api/v1/analytics/events/batch
```

Admin can view:

```http
GET /api/v1/admin/analytics/overview
GET /api/v1/admin/analytics/events
GET /api/v1/admin/analytics/funnels
GET /api/v1/admin/analytics/errors
```

## Key Events

Screen events include `LOGIN_VIEWED`, `REGISTER_VIEWED`, `JOBS_VIEWED`, `JOB_DETAILS_VIEWED`, `CREATE_JOB_VIEWED`, `OFFER_DETAILS_VIEWED`, `ACTIVITY_VIEWED`, `MESSAGES_VIEWED`, `CONVERSATION_VIEWED`, `WALLET_VIEWED`, `PROFILE_VIEWED`, and `ADMIN_DASHBOARD_VIEWED`.

Action events include job creation, offer creation, offer selection, contact unlock, messaging, review, token purchase, report, Google login, email verification, and password reset events.

## Funnels

Employer funnel:

```text
REGISTER_VIEWED -> EMPLOYER_REGISTER_COMPLETED -> CREATE_JOB_VIEWED -> JOB_CREATED -> OFFER_SELECTED -> COMPLETION_CONFIRMED -> CONTRACTOR_REVIEW_LEFT
```

Contractor funnel:

```text
REGISTER_VIEWED -> CONTRACTOR_REGISTER_COMPLETED -> ONBOARDING_COMPLETED -> JOB_DETAILS_VIEWED -> OFFER_CREATED -> CONTACT_UNLOCKED -> JOB_MARKED_COMPLETED -> EMPLOYER_REVIEW_LEFT
```

## Debugging

Run:

```bash
npm run smoke:analytics --workspace @malta-marketplace/api
```

Analytics failures are fire-and-forget on mobile and must never block normal app usage.

