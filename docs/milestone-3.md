# Milestone 3

## Scope

Milestone 3 implements token management only:

- Token packages
- User wallet balance
- Token transaction history
- Free instant mock purchases
- Refund requests
- Admin refund approval and rejection

It does not implement Stripe, real payments, contact unlocks, chat, reviews, or notifications.

## Architecture

Backend:

- `tokens` module exposes user wallet endpoints.
- `admin/tokens` endpoints are separated from user wallet endpoints.
- All wallet mutations happen inside database transactions.
- Every balance change creates a `TokenTransaction`.
- Mock purchases are isolated so future Stripe integration can replace that purchase method without changing wallet balance or ledger rules.

Mobile:

- Wallet tab added to authenticated navigation.
- Users can view balance, buy packages, inspect transactions, request refunds, and see refund history.
- Admins see refund requests and can approve or reject them from the app.

## Database Changes

Milestone 3 updates the prepared token schema:

- `TokenPackage.price` decimal replaces cents-only pricing.
- `TokenPackage.isActive` controls purchase availability.
- `UserTokenBalance` receives its own `id`, `createdAt`, and unique `userId`.
- `TokenTransaction.description` records readable ledger context.
- `TokenTransaction.relatedRefundRequestId` links approved refund ledger entries.
- `RefundRequest` uses `tokenTransactionId`, `amount`, and `reviewedByAdminId`.

## API Endpoints

Packages:

- `GET /api/v1/tokens/packages`
- `POST /api/v1/admin/tokens/packages`
- `PATCH /api/v1/admin/tokens/packages/:id`

Wallet:

- `GET /api/v1/tokens/balance`
- `GET /api/v1/tokens/transactions?page=1&limit=20`
- `POST /api/v1/tokens/mock-purchase`

Refunds:

- `POST /api/v1/tokens/refunds`
- `GET /api/v1/tokens/refunds/mine?page=1&limit=20`
- `GET /api/v1/admin/tokens/refunds?page=1&limit=20`
- `POST /api/v1/admin/tokens/refunds/:refundRequestId/approve`
- `POST /api/v1/admin/tokens/refunds/:refundRequestId/reject`

## Authorization

Employers and contractors can:

- View packages
- Use mock purchases
- View wallet balance
- View own transactions
- Create refund requests
- View own refunds

Admins can:

- Create and edit packages
- View all refund requests
- Approve and reject refund requests

Suspended users are rejected by JWT validation before reaching wallet actions.

## Verification

Run after API is running:

```bash
npm run smoke:milestone3 --workspace @malta-marketplace/api
```

The smoke test verifies package listing, admin package management, mock purchases, balance changes, transaction history, refund creation, duplicate refund prevention, refund rejection, refund approval, admin refund listing, pagination, and employer wallet access.
