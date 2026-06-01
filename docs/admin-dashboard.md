# Admin Dashboard

Milestone 7 adds an admin-only operational area for moderation and platform visibility.

## Access

Only active users with role `ADMIN` can use admin endpoints and mobile admin screens. Non-admin users receive `403 Forbidden`. Suspended users are rejected by authentication before reaching admin controllers.

## Mobile Navigation

Admin bottom navigation:

```text
Dashboard
Users
Jobs
Moderation
Profile
```

## Dashboard

The dashboard shows MVP statistics for users, jobs, offers, tokens, reviews, conversations, messages, refunds, and mock revenue. Revenue is calculated from mock token purchases only. No real payment gateway is included.

## Moderation

Admins can:

1. Suspend and activate users.
2. Close jobs that should no longer be active.
3. Approve or reject refund requests.
4. Remove reviews.
5. View contact unlocks.
6. View conversations and message history.
7. View audit logs.

Admins cannot send messages in participant conversations.

## Audit Logs

The platform creates audit logs for admin mutations:

```text
USER_SUSPENDED
USER_ACTIVATED
JOB_CLOSED_BY_ADMIN
REVIEW_REMOVED
REFUND_APPROVED
REFUND_REJECTED
TOKEN_PACKAGE_CREATED
TOKEN_PACKAGE_UPDATED
```

Audit logs are immutable through the API and are intended for moderation traceability.
