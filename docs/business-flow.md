# MaltaPro Business Flow Notes

## Offer Selection And Cancellation

When an employer selects an offer:

- selected offer becomes `SELECTED`
- job becomes `IN_PROGRESS`
- other pending offers become `REJECTED`
- those automatically rejected offers receive reason `AUTO_REJECTED_BY_SELECTION`

When the employer cancels the selected offer before contact unlock:

- selected offer becomes `REJECTED`
- selected offer receives reason `SELECTION_CANCELLED_BY_EMPLOYER`
- job becomes `ACTIVE`
- offers rejected with `AUTO_REJECTED_BY_SELECTION` return to `PENDING`
- offers rejected with `MANUALLY_REJECTED_BY_EMPLOYER` remain rejected

When a job is closed by admin/moderation:

- affected pending or auto-rejected offers can receive reason `JOB_CLOSED`
- manually rejected offers are not restored by later selection cancellation

## Email Verification

Verification email button opens:

```text
maltapro://verify-email?token=...
```

The mobile Verify Email screen calls the backend verification endpoint and shows clear success or expired/invalid token states.

The API also exposes:

```http
GET /api/v1/auth/verify-email?token=...
```

This returns a simple HTML success/error page for web fallback links.
