# Codex Start Here

This file is a fast project map for future Codex sessions. Use it before changing code.

## Project Shape

- Backend: `apps/api`
  - NestJS + TypeScript + Prisma + PostgreSQL.
  - Main module registry: `apps/api/src/app.module.ts`.
  - Database schema: `apps/api/prisma/schema.prisma`.
  - Migrations: `apps/api/prisma/migrations`.
  - Seed data: `apps/api/prisma/seed.ts`.
  - Smoke tests: `apps/api/scripts/*.mjs`.
- Mobile app: `apps/mobile`
  - Expo React Native + TypeScript.
  - Root app/provider: `apps/mobile/App.tsx`.
  - Navigation: `apps/mobile/src/navigation`.
  - API client/hooks: `apps/mobile/src/api`.
  - Screens: `apps/mobile/src/screens`.
  - Shared UI: `apps/mobile/src/components`.
  - Design system: `apps/mobile/src/design`.
  - Domain types: `apps/mobile/src/types/domain.ts`.
  - Expo config/icon/build settings: `apps/mobile/app.json`, `apps/mobile/app.config.js`.
- Docs: `docs`
  - Business flows: `docs/business-flow.md`.
  - Refresh strategy: `docs/refresh-strategy.md`.
  - Mobile QA notes: `docs/mobile-qa-fixes.md`.
  - Contractor verification: `docs/contractor-verification.md`.

## General Change Workflow

When implementing a feature, usually update in this order:

1. Prisma schema/migration if data changes.
2. Backend DTOs, service logic, controller endpoint, authorization checks.
3. Mobile domain types in `apps/mobile/src/types/domain.ts`.
4. Mobile API client in `apps/mobile/src/api/client.ts`.
5. React Query hook/invalidation in `apps/mobile/src/api/*Hooks.ts` and `invalidation.ts`.
6. Screen/component changes.
7. Docs and smoke test if behavior changed.

Never trust mobile permissions. Backend guards/services must enforce roles and ownership.

## Feature Map

### Auth, Roles, Profiles

- Backend:
  - `apps/api/src/auth`
  - `apps/api/src/users`
  - shared auth decorators/guards in `apps/api/src/common`
- Mobile:
  - auth store: `apps/mobile/src/store/auth.store.ts`
  - auth screens: `apps/mobile/src/screens/auth`
  - profile edit: `apps/mobile/src/screens/profile/ProfileEditScreen.tsx`

### Employer Job Requests

- Backend:
  - `apps/api/src/jobs`
  - job DTOs in `apps/api/src/jobs/dto`
  - images/local upload integration in `apps/api/src/uploads`
- Mobile:
  - list/browse: `apps/mobile/src/screens/employer/EmployerJobsScreen.tsx`
  - create/edit: `apps/mobile/src/screens/employer/JobFormScreen.tsx`
  - details/offers: `apps/mobile/src/screens/employer/JobDetailsScreen.tsx`
  - category config: `apps/mobile/src/config/serviceCategories.ts`

### Contractor Offers And Work Details

- Backend:
  - `apps/api/src/offers`
  - important endpoint: `GET /api/v1/offers/:offerId/work-details`
  - action rules live in `OffersService.availableActions`
- Mobile:
  - My Offers list: `apps/mobile/src/screens/contractor/MyOffersScreen.tsx`
  - shared offer card: `apps/mobile/src/components/OfferWorkCard.tsx`
  - central work screen: `apps/mobile/src/screens/contractor/OfferWorkDetailsScreen.tsx`
  - offer form: `apps/mobile/src/screens/contractor/OfferFormScreen.tsx`
  - offer helpers: `apps/mobile/src/utils/offerWork.ts`

### Tokens, Payments, Refunds

- Backend:
  - tokens/wallet: `apps/api/src/tokens`
  - mock/Stripe-ready payments: `apps/api/src/payments`
  - admin refund handling is under tokens/payments/admin paths.
- Mobile:
  - wallet screens: `apps/mobile/src/screens/wallet`
  - token hooks: `apps/mobile/src/api/tokenHooks.ts`
  - payment hooks: `apps/mobile/src/api/paymentHooks.ts`

### Contact Unlocks

- Backend:
  - `apps/api/src/contacts`
  - secure token spend/contact unlock logic belongs here.
- Mobile:
  - contact hooks: `apps/mobile/src/api/contactHooks.ts`
  - unlock screen: `apps/mobile/src/screens/contractor/UnlockContactScreen.tsx`
  - contact details: `apps/mobile/src/screens/wallet/ContactDetailsScreen.tsx`

### Conversations, Messages, Notifications

- Backend:
  - conversations: `apps/api/src/conversations`
  - messages: `apps/api/src/messages`
  - notifications: `apps/api/src/notifications`
- Mobile:
  - message hooks: `apps/mobile/src/api/messageHooks.ts`
  - notification hooks: `apps/mobile/src/api/notificationHooks.ts`
  - conversations list: `apps/mobile/src/screens/messages/ConversationsScreen.tsx`
  - thread/composer: `apps/mobile/src/screens/messages/ConversationThreadScreen.tsx`
  - alerts: `apps/mobile/src/screens/notifications/NotificationsScreen.tsx`
- Navigation rule:
  - Messages tab opens conversation list.
  - Offer/Activity/Alert chat actions open a specific thread.

### Completion And Reviews

- Backend:
  - `apps/api/src/reviews`
  - contractor mark complete: `POST /contacts/:contactId/complete`
  - employer confirm completion: `POST /contacts/:contactId/confirm-completion`
  - review/reply/admin removal also lives here.
- Mobile:
  - review hooks: `apps/mobile/src/api/reviewHooks.ts`
  - completion actions appear in:
    - `JobDetailsScreen.tsx`
    - `ContactDetailsScreen.tsx`
    - `OfferWorkDetailsScreen.tsx`
  - review screens: `apps/mobile/src/screens/reviews`

### Activity

- Backend:
  - `apps/api/src/activity`
- Mobile:
  - activity screen: `apps/mobile/src/screens/activity/ActivityScreen.tsx`
  - activity hook: `apps/mobile/src/api/activityHooks.ts`
  - contractor badge viewed-state: `apps/mobile/src/store/activity.store.ts`
- Important:
  - Do not call `/notifications/read-all` automatically from Activity.
  - Contractor badge is local viewed-state based.
  - Employer Alerts tab keeps notification unread count behavior.

### Admin

- Backend:
  - `apps/api/src/admin`
  - admin controllers also exist inside feature modules such as reviews, contacts, conversations, verifications.
- Mobile:
  - dashboard/users/jobs/moderation: `apps/mobile/src/screens/admin`
  - admin hooks: `apps/mobile/src/api/adminHooks.ts`

### Contractor Portfolio And Verification

- Backend:
  - `apps/api/src/contractor-verifications`
  - portfolio/verification file storage: `apps/api/src/uploads`
  - schema models: `ContractorPortfolioImage`, `ContractorVerification`
- Mobile:
  - profile upload/status UI: `apps/mobile/src/screens/profile/ProfileEditScreen.tsx`
  - hooks: `apps/mobile/src/api/offerWorkHooks.ts`
  - admin review UI: `apps/mobile/src/screens/admin/AdminModerationScreen.tsx`
- Security:
  - Portfolio is public enough for employer evaluation.
  - Verification documents are admin-only.

### Mobile UI Infrastructure

- Navigation stacks/tabs: `apps/mobile/src/navigation/RootNavigator.tsx`, `types.ts`.
- Base screen/keyboard wrapper: `apps/mobile/src/components/Screen.tsx`.
- Date formatting: `apps/mobile/src/utils/date.ts`.
- Design tokens: `apps/mobile/src/design/colors.ts`, `theme.ts`.
- App icon/build config: `apps/mobile/app.json`, assets in `apps/mobile/assets`.

## Commands

Common setup/run:

```bash
npm run prisma:migrate --workspace @malta-marketplace/api
npm run prisma:seed --workspace @malta-marketplace/api
npm run api:dev
npm run mobile:start
```

Mobile API URL:

```bash
npm run mobile:api-url:set -- https://YOUR-NGROK-DOMAIN.ngrok-free.dev/api/v1
npm run mobile:api-url:check
```

Checks:

```bash
npm run typecheck
npm run lint
npm run smoke:ux-consolidation --workspace @malta-marketplace/api
```

APK:

```bash
npm run mobile:apk
```

## Current QA Notes

- Expo mobile uses API URL from `apps/mobile/app.config.js` / `EXPO_PUBLIC_API_URL`.
- Ngrok requests need `ngrok-skip-browser-warning: true`; the mobile API client already adds it when needed.
- Message composer and form screens rely on keyboard-aware layout; avoid absolute-positioned submit bars.
- Dates displayed to users should use helpers from `apps/mobile/src/utils/date.ts`.
- The repo may have existing uncommitted sprint work. Do not revert files unless the user explicitly asks.
