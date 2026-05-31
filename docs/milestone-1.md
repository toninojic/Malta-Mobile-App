# Milestone 1

## Architecture

Milestone 1 establishes the production foundation:

- NestJS REST API with modular boundaries.
- PostgreSQL and Prisma schema for the full MVP domain.
- JWT authentication with refresh tokens.
- Role-based authorization.
- User profile management.
- Employer-only job request CRUD and renewal.
- Expo mobile app with authentication, profile editing, and employer job management.

## Database Changes

Milestone 1 uses:

- `User` for identity, role, status, password hash, and refresh token hash.
- `UserProfile` for editable user profile information.
- `JobRequest` for employer job posts.
- `JobImage` for image URL records.

`JobRequest.expiresAt` defaults to 30 days after creation at the service layer. Renewal sets a fresh 30-day expiration and returns status to `ACTIVE`.

## API Endpoints

Authentication:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

Profiles:

- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me/profile`

Employer job requests:

- `POST /api/v1/jobs`
- `GET /api/v1/jobs/mine`
- `GET /api/v1/jobs/:id`
- `PATCH /api/v1/jobs/:id`
- `POST /api/v1/jobs/:id/renew`
- `DELETE /api/v1/jobs/:id`

Authorization:

- Only `EMPLOYER` and `ADMIN` can create, edit, renew, and delete job requests.
- Employers can access only their own job requests.
- Admins can access any job request.

## Mobile Screens

Auth:

- Onboarding
- Login
- Registration with role selection

App:

- Employer job list
- Create job
- Edit job
- Job details
- Profile edit

The design system is dark-mode ready and uses reusable primitives instead of styling screens independently.
