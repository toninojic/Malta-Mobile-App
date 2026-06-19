# MaltaPro RevenueCat / IAP Notes

## Token Purchases

RevenueCat verified purchases credit contractor wallets through backend webhook processing. The purchase flow must create a token ledger entry and must not directly mutate wallet balances outside the transaction service.

## Refunds

Contractor-facing refund request UI has been removed from the mobile wallet because Apple/Google/RevenueCat monetary refunds are handled through store support flows.

Backend/admin refund tools may remain for internal or legacy review, but the standard contractor mobile wallet flow is:

1. Buy package.
2. RevenueCat verifies purchase.
3. Backend webhook credits tokens.
4. Wallet transaction history shows the purchase.

## Promotional Tokens

Promotional tokens are separate from store purchases:

- `WELCOME_BONUS`: granted once after new contractor setup is completed.
- `ADMIN_GRANT`: manually granted by admin with reason.
- `ADMIN_REVOKE`: manually revoked by admin with reason and balance protection.
- `REFERRAL_BONUS`: reserved for future referral logic.

All promotional adjustments create token transactions. Admin grant/revoke operations also create audit logs and contractor notifications.
