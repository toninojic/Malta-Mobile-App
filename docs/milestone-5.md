# Milestone 5 - Messaging And Notifications

## Scope

Milestone 5 implements REST-based text messaging and database-backed in-app notifications only. It does not add Stripe, reviews, ratings, push notifications, email notifications, WebSockets, or real-time infrastructure.

## Backend Architecture

New NestJS modules:

- `conversations` lists participant conversations and exposes admin conversation visibility.
- `messages` sends text messages, returns message history, updates read status, and rate-limits message creation.
- `notifications` stores in-app notifications, unread counts, read updates, and admin notification visibility.

All business rules live in services. Controllers remain thin and all protected endpoints use JWT plus role guards.

## Database Changes

New tables:

- `Conversation`: one row per unlocked `ContactUnlock`.
- `Message`: text message records with `isRead`, `deletedAt`, and future-ready `type`/`metadata`.
- `Notification`: database notification records with `isRead`, `readAt`, and JSON metadata.

Important constraints:

- `Conversation.contactUnlockId` is unique, preventing duplicate conversations.
- Messages reference a conversation and sender.
- Notifications reference the owning user.

## API Endpoints

User endpoints:

- `GET /api/v1/conversations`
- `GET /api/v1/conversations/:id`
- `GET /api/v1/conversations/:id/messages`
- `POST /api/v1/conversations/:id/messages`
- `PATCH /api/v1/messages/:id/read`
- `GET /api/v1/notifications`
- `GET /api/v1/notifications/unread-count`
- `PATCH /api/v1/notifications/:id/read`
- `PATCH /api/v1/notifications/read-all`

Admin endpoints:

- `GET /api/v1/admin/conversations`
- `GET /api/v1/admin/conversations/:id`
- `GET /api/v1/admin/notifications`

## Mobile Screens

Added authenticated tabs:

- `Messages`: conversation list, last message preview, unread message badge, thread view, message composer.
- `Alerts`: notification list, unread indicator, mark one as read, mark all as read.

Unlocked contact details can open a conversation. If no conversation exists yet, the first message creates it automatically.

## Security Rules

- Messages can be sent only inside an unlocked `ContactUnlock` relationship.
- Users can view only conversations they participate in.
- Admins can view all conversations and notifications through admin endpoints.
- Sender identity comes from JWT, never from request body.
- Message content is trimmed and sanitized for control characters.
- Message creation is rate-limited.

## Verification

Start Postgres and the API, then run:

```bash
npm run smoke:milestone5 --workspace @malta-marketplace/api
```

The smoke test verifies pre-unlock blocking, unlock flow, conversation creation, duplicate prevention, message history, read status, notification creation/read counts, authorization protection, and admin visibility.
