# Architecture

## Product Boundary

The primary product is a mobile application for iOS and Android. The backend exposes a REST API that validates all permissions server-side. No user-facing web application is part of the MVP.

## Monorepo Layout

```text
apps/
  api/      NestJS API, Prisma, PostgreSQL
  mobile/   Expo React Native app
docs/       Architecture, schema, milestone contracts
```

## Backend Architecture

The API is organized by business modules:

- `auth` owns registration, login, refresh tokens, password hashing, JWT issue/verify.
- `users` owns profile reads and edits.
- `jobs` owns employer job request CRUD and renewal.
- `offers` owns contractor offer creation, editing, withdrawal, employer masked viewing, and employer selection.
- `tokens` owns token packages, wallet balances, transaction history, refund requests, and admin refund decisions.
- `payments` owns Stripe Checkout session creation, payment history, webhook signature verification, and idempotent token grants.
- `contacts` owns contact requests, token spending for unlocks, identity visibility, and unlocked relationship reads.
- `conversations` owns unlocked relationship conversation listing and admin conversation visibility.
- `messages` owns text message delivery, message history, read status, and message creation rate limiting.
- `notifications` owns database-backed in-app notifications, unread counts, read updates, and admin notification visibility.
- `reviews` owns job completion requests, employer confirmation, reviews, contractor replies, review moderation, and rating summaries.
- Future milestone modules will add push notifications and richer country expansion workflows.

Security rules:

- Access tokens are short-lived JWTs.
- Refresh tokens are stored only as bcrypt hashes.
- Passwords are stored only as bcrypt hashes.
- Role decisions are enforced with Nest guards, not trusted from the client.
- Suspended users are rejected by JWT strategy.
- All request DTOs are validated and stripped of unknown fields.
- Rate limiting is enabled globally.

## Mobile Architecture

The Expo app is structured around:

- React Navigation for auth/app stacks.
- React Query for server state.
- Zustand for session state.
- A reusable design system with colors, typography, spacing, buttons, cards, inputs, badges, and screens.

The app starts with onboarding, then supports registration/login, profile editing, employer job CRUD, contractor job browsing, contractor offers, employer masked offer review, Stripe test checkout for token purchases, token wallet/refund workflows, contact unlock workflows, conversation messaging, in-app notifications, completion actions, reviews, rating summaries, and admin review moderation.

## Storage Architecture

Milestone 1 stores job image URLs in the database. The schema separates `JobImage` rows from `JobRequest` so S3-compatible uploads can be added without changing the job model. A future storage module should issue pre-signed upload URLs, validate MIME type/size, and persist object keys.

## Notification Architecture

Milestone 5 stores notifications in PostgreSQL with read/unread state and mobile badge counts. Firebase push can later subscribe to notification creation events without changing product workflows.

## Payment Architecture

Milestone 8 uses Stripe Checkout in test mode. Checkout creation stores a `Payment` as `PENDING` and returns Stripe's hosted checkout URL. Tokens are never granted during checkout creation. The signed Stripe webhook is the only path that marks a payment `PAID`, increments `UserTokenBalance`, and creates a `PURCHASE` `TokenTransaction`. Duplicate checkout completion events are idempotent and do not grant tokens twice.

## Contact Unlock Architecture

Milestone 4 keeps employers and contractors anonymous until a contractor spends one token. Employer contact requests create a pending `ContactUnlock`; contractor unlocks atomically deduct one token, create a `SPEND` transaction, and mark the relationship unlocked. Milestone 5 creates one `Conversation` per unlocked contact relationship when the first text message is sent.

## Messaging Architecture

Messaging is REST-only for the MVP. A conversation belongs to one unlocked `ContactUnlock` relationship, and both participants are validated on every read/write endpoint. Message creation runs in a database transaction with conversation creation, `lastMessageAt` updates, and notification creation. Messages are soft-delete ready through `deletedAt` and are ordered by `createdAt` ascending in history responses.

## Completion And Review Architecture

Milestone 6 stores completion state separately in `JobCompletion`, keyed by the unlocked contact relationship. Contractors can request completion, employers confirm it, and the job request status becomes `COMPLETED`. Reviews are created only after confirmed completion. Contractor rating summaries are denormalized in `ContractorRatingSummary` and recalculated transactionally after review creation or admin removal. Removed reviews stay in the database and do not count toward summary totals.

## Scalability Notes

- UUID primary keys avoid collision across services and countries.
- Country is modeled implicitly for now through location text; future country expansion should add normalized `countryCode` and geospatial indexes.
- Token balance uses a `version` field for optimistic concurrency during spend operations.
- Messages are modeled for future media types while Milestone 5 allows only text.
