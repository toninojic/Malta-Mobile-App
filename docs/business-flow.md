# Business Flow

This marketplace keeps the work flow separate from the wallet flow. Employers manage jobs from My Jobs. Contractors manage all offer/work status from My Offers and use Wallet only for tokens.

## Main Flow

```text
Employer posts job
->
Contractors send offers
->
Employer selects offer
->
Contractor receives notification
->
Contractor spends 1 token
->
Contact unlocks
->
Conversation opens
->
Contractor marks job completed
->
Employer confirms completion
->
Employer leaves review
```

## Step Rules

1. Employer creates an ACTIVE job with title, description, category, subcategory, location, and optional images.
   Job title must be at least 5 characters, description at least 20 characters, and category/subcategory must be a valid service combination from the shared category list.
2. Contractors browse ACTIVE jobs and submit PENDING offers with estimated price, start date, completion days, and optional message.
3. Employers see masked offers: price, completion time, message, average rating, and total reviews. Contractor identity stays hidden.
4. Employer selects one offer. The offer becomes SELECTED, the job becomes IN_PROGRESS, a locked ContactUnlock is created, and every other pending offer for that job is automatically REJECTED.
5. Contractor receives `OFFER_SELECTED` and opens Offer / Work Details. Backend `availableActions` makes `UNLOCK_CONTACT` the primary action.
6. Unlocking spends 1 token, creates a SPEND transaction, marks ContactUnlock as UNLOCKED, and reveals both parties.
7. Chat opens through the ContactUnlock. Existing conversations are reused by `contactUnlockId`.
8. Contractor marks the unlocked job completed. Employer receives confirmation notification.
9. Employer confirms completion. Job becomes COMPLETED and the selected offer becomes COMPLETED.
10. Review becomes available only after confirmed completion.

After completion, contractor offer cards become read-only for marketplace actions: edit, withdraw, and unlock controls are hidden. Chat may still be opened when the contact is already unlocked and review details can be viewed when available.

Only one offer can be SELECTED for a job at a time. A database partial unique index and backend transaction enforce this rule for active selected offers. Employers may manually reject individual pending offers. Rejected contractors cannot edit or unlock those offers, but rejected offers remain visible in historical views when filters allow them.

If the selected contractor does not unlock contact, the employer can cancel the selection before contact is unlocked. Cancel Selection changes the selected offer to REJECTED and returns the job to ACTIVE so it appears again in contractor All Jobs. Offers that were auto-rejected during the original selection remain rejected for MVP simplicity.

Visual status follows the current work step:

```text
PENDING -> SELECTED -> UNLOCKED / IN_PROGRESS -> PENDING_CONFIRMATION -> COMPLETED
```

`Selected by employer` may remain visible as historical context after unlock or completion, but the active visual status must move forward to unlocked, in progress, pending confirmation, or completed.

## CLOSED vs COMPLETED

`CLOSED` means the employer manually closed or cancelled the job. It is hidden from public contractor browsing, contractors cannot offer, and no review is allowed.

`COMPLETED` means the work was completed through the platform: contact was unlocked, contractor marked completion, and employer confirmed it. Reviews are allowed and the job counts as completed work.

## Role Ownership

Employers never spend tokens and do not need Wallet. Their bottom navigation is Jobs, Activity, Messages, Alerts, and Profile.

Contractors buy and spend tokens. They access Wallet from Activity instead of the bottom tab. The visible contractor bottom navigation is Jobs, Activity, Messages, Alerts, and Profile.

Contractor Activity is intentionally small:

```text
My Offers -> central contractor offer/work center with status filters
My Reviews -> contractor reviews
```

Jobs -> My Offers opens the same work center in active-only mode, showing pending, selected, unlocked, in-progress, and pending-confirmation offers by default.

Offer / Work Details is the contractor source of truth. It always fetches `GET /api/v1/offers/:offerId/work-details` and displays offer status, job status, contact unlock status, completion status, review state, conversation state, allowed identity data, and backend-calculated `availableActions`.

After contact unlock, employers can open the full contractor profile. The profile may show contractor name, avatar, verified badge, rating, reviews, portfolio images, bio, company profile, email, and phone when available. Before unlock, employers may see public evaluation signals such as rating, portfolio, and verified badge, but private contact information and verification documents remain hidden.

Verified contractor badges open an informational modal only. The modal explains that MaltaPro admins reviewed and approved verification documents. The documents themselves remain admin-only.

Employers keep a compact Activity structure:

```text
My Jobs -> own jobs, received offers, selected offers, completion confirmation, reviews to leave
My Reviews -> completed jobs waiting for employer review and review-related updates
```

Employer My Reviews badges count completed jobs waiting for employer review plus unread review-related notifications (`REVIEW_RECEIVED` and `REVIEW_REPLIED`). The count clears when the employer submits the pending review and notifications are read through the normal Alerts flow.

## Reverse Employer Reviews

After a job is completed and confirmed, the employer may review the contractor once and the contractor may review the employer once for the same unlocked contact relationship.

Employer review rules:

- only the contractor on the completed unlocked contact can review the employer
- the job must be `COMPLETED` and the completion must be `CONFIRMED`
- one employer review is allowed per completed contact/offer
- employer rating summaries store average rating and total reviews
- contractors may see anonymous employer rating signals before unlock
- employer email, phone, and other private identity data remain hidden before unlock

## Selection Cancellation

When an employer selects one offer, other pending offers are marked `REJECTED` with reason `AUTO_REJECTED_BY_SELECTION`.

If the employer cancels the selected offer before contact unlock:

- the job returns to `ACTIVE`
- offers rejected automatically by that selection return to `PENDING`
- offers manually rejected by the employer stay `REJECTED`
- the cancelled selected offer becomes `REJECTED` with reason `SELECTION_CANCELLED_BY_EMPLOYER`

Closed jobs are terminal marketplace states. Contractor work surfaces show `JOB CLOSED`, and backend `availableActions` returns only view-only actions for closed jobs.

## Payments

The mobile wallet reads `GET /api/v1/payments/config` before purchase actions.

If `ALLOW_MOCK_PURCHASES=true`, the API returns mock mode (`allowMockPurchases=true` / `mockPurchasesEnabled=true`) and Buy Package uses the mock purchase endpoint. Stripe keys are not required, tokens are added immediately, and a PURCHASE token transaction is recorded.

If `ALLOW_MOCK_PURCHASES=false`, Buy Package uses Stripe Checkout. When Stripe keys are missing in that mode, the wallet shows `Payments are not configured.`

Admins can view operational data but do not participate in marketplace conversations or token unlocks as a user.

## Admin Oversight

Admins have a dedicated mobile area with Dashboard, Users, Jobs, Moderation, and Profile tabs. Admin API access is protected by JWT and the `ADMIN` role on the backend. Suspended admins cannot access admin endpoints because inactive users are rejected during JWT validation.

Admins can see users, jobs, offers, contact unlocks, conversations, messages, reviews, refunds, notifications, statistics, and audit logs. Admins may inspect conversations and messages for moderation, but they cannot send marketplace messages.

Admins can moderate these records:

1. Suspend or activate users.
2. Close non-completed jobs.
3. Remove reviews.
4. Approve or reject refund requests.
5. Create or update token packages.
6. Approve or reject contractor verification documents.

The following admin mutations create immutable audit logs:

```text
USER_SUSPENDED
USER_ACTIVATED
JOB_CLOSED_BY_ADMIN
REVIEW_REMOVED
REFUND_APPROVED
REFUND_REJECTED
TOKEN_PACKAGE_CREATED
TOKEN_PACKAGE_UPDATED
CONTRACTOR_VERIFICATION_APPROVED
CONTRACTOR_VERIFICATION_REJECTED
```

Audit logs store the admin user, action, entity type, entity id, timestamp, and JSON metadata with the moderation context. Audit logs are read-only from the API.
