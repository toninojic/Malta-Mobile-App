# Stripe Test Mode

Milestone 8 uses Stripe Checkout in test mode for token package purchases. No live payments are enabled.

## Environment

Add these values to `apps/api/.env`:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SUCCESS_URL=maltacraftsman://payment-success
STRIPE_CANCEL_URL=maltacraftsman://payment-pending
```

The mobile app does not need the publishable key for this milestone because the API creates hosted Checkout Sessions and returns `checkoutUrl`.

## Local Webhook Testing

Install and run the Stripe CLI, then forward events to the API:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/v1/payments/webhook
```

Copy the printed `whsec_...` value into `STRIPE_WEBHOOK_SECRET`, then restart the API.

## Test Card

Use Stripe's standard test card:

```text
4242 4242 4242 4242
Any future expiry date
Any CVC
Any billing ZIP
```

## Flow

1. Contractor opens Wallet.
2. Contractor selects a token package.
3. API creates a `PENDING` `Payment` and a Stripe Checkout Session.
4. Mobile opens the returned Checkout URL.
5. Stripe sends `checkout.session.completed` to the webhook.
6. API verifies the Stripe signature.
7. API marks the payment `PAID`, creates a `PURCHASE` token transaction, and increments wallet balance.

Tokens are not added by the checkout creation endpoint. The webhook is the only token grant path.

`/tokens/mock-purchase` is disabled by default in Milestone 8. Keep `ALLOW_MOCK_PURCHASES=false` for Stripe testing and production-like environments.

## Smoke Test

With the API running:

```bash
npm run smoke:milestone8 --workspace @malta-marketplace/api
```

If `STRIPE_SECRET_KEY` is not configured, the smoke test still validates webhook behavior by seeding a local pending payment. A real Checkout Session is verified when valid Stripe test keys are present.
