# MaltaPro Mobile QA Fixes

## Token Wallet Refund UI

Contractor wallet UI no longer shows refund request actions or a "My refund requests" section.

Expected QA result:

- Contractors can still view balance, packages, purchase history, and transaction history.
- Contractors cannot request a token refund from mobile UI.
- Admin refund queue remains available to admins where legacy/internal refund review is still needed.
- Store monetary refunds are handled through Apple/Google/RevenueCat support flows, outside the contractor wallet.

## Welcome Bonus

New contractors receive welcome tokens only after completing contractor setup. Registration alone must not credit tokens.

Expected QA result:

- Complete contractor setup once, then wallet receives a `WELCOME_BONUS` transaction.
- Restarting the app or logging in again does not grant a second bonus.
- Skipping contractor setup does not grant welcome tokens.
- Existing contractor accounts are not automatically granted welcome tokens.

## Admin Token Adjustments

Admin users can grant or revoke contractor tokens from the Admin Users screen.

Expected QA result:

- Grant tokens requires a reason and defaults to 10 tokens.
- Revoke tokens requires amount and reason.
- Revoke cannot exceed current contractor balance.
- Employers and admins cannot receive promotional token grants.
- Contractor sees wallet transaction history and notification for grant/revoke.
