# MaltaPro Business Flow

## Employer Job Creation

Employers can create job requests manually from the existing Create Job form.

Employers can also use AI Job Assistant as an optional drafting path:

1. Employer opens the floating AI button.
2. Employer describes the job in natural language.
3. AI asks follow-up questions when required details are missing.
4. AI creates a structured draft.
5. Employer can edit manually, discard, or publish.
6. Publishing uses the same backend job creation service as manual creation.

AI never publishes automatically. The employer must confirm publishing.

## Contractor Discovery

When a job is created manually or from AI publish, the normal nearby matching path runs. Contractors with matching service location/category preferences can receive `NEW_JOB_NEARBY` notifications when their preferences allow it.

## Token Rules

Only contractors spend tokens. Employers do not receive promotional, welcome, referral, or admin-granted tokens.

Contractors can buy token packages through the configured purchase flow. Token spending for contact unlocks is unchanged: unlocking contact creates a ledgered spend transaction and must never be bypassed by direct balance mutation.

Admin promotional adjustments are controlled operations:

1. Admin grants can be applied only to contractor accounts.
2. Admin revokes can be applied only to contractor accounts and cannot make the balance negative.
3. Every grant or revoke creates a `TokenTransaction`.
4. Every admin grant or revoke creates an `AuditLog`.
5. The contractor receives an in-app notification.

Welcome bonus tokens are granted only after a brand new contractor completes the contractor setup flow. They are not granted during registration and are not automatically backfilled to existing contractors. The bonus is controlled by `WELCOME_BONUS_ENABLED` and `WELCOME_BONUS_TOKENS`, and is idempotent per contractor.

`REFERRAL_BONUS` is reserved for a future referral system and is not active yet.

## Refund Flow

Contractor wallet screens no longer expose refund request UI. Monetary refunds for Apple/Google/RevenueCat purchases are handled outside the contractor wallet flow through app-store support flows. Existing backend/admin refund tools can remain available for internal review and legacy operations.

## Privacy

AI drafts do not include contact details, prices, contractor recommendations, or private user data. OpenAI calls are made only by the backend API.
