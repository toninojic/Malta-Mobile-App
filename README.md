# Malta Craftsman Marketplace

Production-ready MVP foundation for a Malta-focused mobile marketplace connecting employers with contractors and craftsmen.

This repository is a milestone-based monorepo:

- `apps/api` - NestJS REST API, PostgreSQL, Prisma, JWT auth, role authorization.
- `apps/mobile` - Expo React Native mobile app for iOS and Android.
- `docs` - Architecture, database model, milestone plans, and API contracts.

Current implementation: **Milestone 6**

- Architecture and relational database schema.
- Authentication with access and refresh JWTs.
- Role-based authorization for Employer, Contractor, and Admin.
- User profile creation and editing.
- Employer job request create/read/update/delete/renew.
- Mobile onboarding, login, registration, profile, and employer job request screens.
- Contractor job browsing with category, subcategory, and location filters.
- Contractor offer create, edit, withdraw, and My Offers flow.
- Employer masked offer list and offer selection.
- Admin offer read endpoints.
- Token packages, wallet balance, token transaction history.
- Free instant mock token purchases for MVP development.
- Refund request workflow with admin approval and rejection.
- Mobile Wallet tab with packages, transactions, refunds, and admin refund review.
- Contact unlock flow where contractors spend one token to reveal identities.
- Employer contact requests and unlocked contacts list.
- Admin contact unlock relationship list and details.
- Text-only conversations after contact unlock.
- Message history, unread message tracking, and conversation previews.
- In-app notifications with read/unread state and badge counts.
- Admin conversation and notification visibility.
- Job completion workflow with contractor completion request and employer confirmation.
- Employer reviews, contractor one-time replies, and admin review removal.
- Contractor rating summaries excluding removed reviews.
- Mobile review screens, contractor profiles, and review moderation.

## Quick Start

Prerequisites:

- Node.js `22.13+`
- Docker Desktop
- npm

From Git Bash on Windows:

```bash
cd "/e/10. Malta App"
```

Copy environment files:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
```

Option A, start Postgres and API with Docker:

```bash
docker compose up --build
```

Option B, run Postgres in Docker and the API locally:

```bash
docker compose up -d postgres
npm install
npm run prisma:migrate --workspace @malta-marketplace/api
npm run prisma:seed --workspace @malta-marketplace/api
npm run api:dev
```

Seed users:

```text
employer@malta.test / Password123!
contractor@malta.test / Password123!
admin@malta.test / Password123!
```

Run the Milestone 1 API smoke verification after the API is running:

```bash
npm run smoke:milestone1 --workspace @malta-marketplace/api
```

Run the Milestone 2 API smoke verification after the API is running:

```bash
npm run smoke:milestone2 --workspace @malta-marketplace/api
```

Run the Milestone 3 API smoke verification after the API is running:

```bash
npm run smoke:milestone3 --workspace @malta-marketplace/api
```

Run the Milestone 4 API smoke verification after the API is running:

```bash
npm run smoke:milestone4 --workspace @malta-marketplace/api
```

Run the Milestone 5 API smoke verification after the API is running:

```bash
npm run smoke:milestone5 --workspace @malta-marketplace/api
```

Run the Milestone 6 API smoke verification after the API is running:

```bash
npm run smoke:milestone6 --workspace @malta-marketplace/api
```

Run the mobile app:

```bash
npm run mobile:start
```

For a physical device, set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to your machine LAN address, for example:

```text
EXPO_PUBLIC_API_URL=http://192.168.1.25:3000/api/v1
```

Build an Android APK for external testers:

```bash
npm run mobile:api-url:set -- https://your-public-api.example.com/api/v1
npm run mobile:api-url:check
npm run mobile:apk
```

## Documentation

- [Architecture](docs/architecture.md)
- [Database Schema](docs/database.md)
- [Android APK Testing](docs/apk-testing.md)
- [Milestone 1](docs/milestone-1.md)
- [Milestone 2](docs/milestone-2.md)
- [Milestone 3](docs/milestone-3.md)
- [Milestone 4](docs/milestone-4.md)
- [Milestone 5](docs/milestone-5.md)
- [Milestone 6](docs/milestone-6.md)
