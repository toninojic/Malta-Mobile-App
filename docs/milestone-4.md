# Milestone 4

## Scope

Milestone 4 implements contact unlock only:

- Contractor token spending
- Employer contact requests
- Contact unlock records
- Identity visibility after unlock
- Unlocked contact listing
- Admin contact unlock listing

It does not implement chat messaging, reviews, notifications, Stripe, or real payments.

## Backend

Endpoints:

- `POST /api/v1/offers/:offerId/unlock`
- `POST /api/v1/offers/:offerId/request-contact`
- `GET /api/v1/offers/:offerId/unlock-status`
- `GET /api/v1/contacts`
- `GET /api/v1/contacts/:contactId`
- `GET /api/v1/admin/contacts`
- `GET /api/v1/admin/contacts/:id`

Rules:

- Only contractors spend tokens.
- Contractor can unlock only their own offer.
- Employer can request contact only for offers on their own job requests.
- Unlock cost is one token.
- Balance decrement, `SPEND` transaction, and `ContactUnlock` update happen in one database transaction.
- Employer and contractor identities remain hidden until status is `UNLOCKED`.
- Admin can see all unlock relationships.

## Mobile

Implemented:

- Unlock confirmation screen with current balance and cost.
- Contractor unlock button from job details and My Offers.
- Employer request contact button from offer list.
- Unlocked contacts list.
- Contact details screen.
- Admin contact unlock list and details through the contacts screen.

## Verification

Run after API is running:

```bash
npm run smoke:milestone4 --workspace @malta-marketplace/api
```

The smoke test verifies hidden identity before unlock, employer request contact, unlock status, contractor unlock, one-token spend, SPEND transaction history, visible identity after unlock, contacts list/details, admin reads, insufficient balance protection, inactive offer protection, and duplicate unlock prevention.
