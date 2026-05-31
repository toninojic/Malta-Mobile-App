# Milestone 6 - Completion, Reviews And Ratings

## Scope

Milestone 6 implements job completion, employer confirmation, reviews, contractor replies, rating summaries, admin review removal, and database-backed notifications. It does not implement Stripe, push notifications, advanced analytics, or Milestone 7 functionality.

## Backend Architecture

New NestJS module:

- `reviews`: completion workflow, review creation, contractor replies, rating summary recalculation, admin review moderation, and admin completion visibility.

The module uses existing `ContactUnlock` records as the trusted relationship boundary. Service methods validate role, relationship ownership, completion state, duplicate review rules, and moderation state before any database mutation.

## Database Changes

New models:

- `JobCompletion`: one completion workflow per unlocked contact.
- `ContractorRatingSummary`: denormalized active-review aggregate per contractor.

Updated model:

- `Review`: now includes `contactUnlockId`, `contractorReply`, `contractorReplyAt`, `status`, `removedByAdminId`, and soft removal fields.

New enums:

- `JobCompletionStatus`
- `ReviewStatus`

New notification types:

- `REVIEW_REPLIED`
- `REVIEW_REMOVED`

## API Endpoints

Completion:

- `POST /api/v1/contacts/:contactId/complete`
- `POST /api/v1/contacts/:contactId/confirm-completion`
- `GET /api/v1/contacts/:contactId/completion-status`

Reviews:

- `POST /api/v1/contacts/:contactId/review`
- `GET /api/v1/reviews/:reviewId`
- `GET /api/v1/contractors/:contractorId/reviews`
- `GET /api/v1/contractors/:contractorId/rating-summary`
- `PATCH /api/v1/reviews/:reviewId/reply`

Admin:

- `GET /api/v1/admin/reviews`
- `GET /api/v1/admin/reviews/:reviewId`
- `PATCH /api/v1/admin/reviews/:reviewId/remove`
- `GET /api/v1/admin/completions`
- `GET /api/v1/admin/completions/:completionId`

## Mobile Screens

Added:

- Contact details completion actions.
- Leave review form.
- Review details with contractor reply.
- My reviews for contractors.
- Contractor profile with rating summary and review list.
- Admin review moderation list and removal action.

Notifications continue to appear in the existing Alerts tab.

## Verification

Start Postgres and the API, then run:

```bash
npm run smoke:milestone6 --workspace @malta-marketplace/api
```

The smoke test covers unlock prerequisite, completion request, employer confirmation, review validation, duplicate review blocking, contractor reply rules, rating summary updates, review removal, notifications, and role authorization.
