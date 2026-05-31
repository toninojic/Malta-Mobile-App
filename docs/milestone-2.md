# Milestone 2

## Scope

Milestone 2 adds contractor offers and offer visibility rules. This document now reflects the implemented MVP surface.

This milestone does not implement tokens, contact unlocks, chat, reviews, notifications, payments, or admin moderation workflows. Those remain for later milestones.

## Architecture

Backend:

- Add an `offers` module.
- Keep all permission checks on the backend.
- Contractors can create and edit only their own offers.
- Employers can view offers for their own job requests.
- Admins can view all offers.
- Contractors can browse active job requests but cannot create, edit, renew, or delete job requests.
- Offer identity masking is handled by API response shaping, not by the mobile app.

Mobile:

- Add contractor job browsing screens.
- Add contractor offer create/edit flow.
- Add contractor offer withdraw flow.
- Add employer offer list on job details.
- Add employer offer selection.
- Display hidden contractor identity before unlock.
- Display visible offer details only allowed by the current role and unlock state.

## Database Changes

The `Offer` table already existed from the Milestone 1 schema and was tightened for Milestone 2:

- `id`
- `jobRequestId`
- `contractorId`
- `estimatedPrice`
- `estimatedCompletionDays`
- `message`
- `status`
- `selectedByEmployer`
- `deletedAt`
- `createdAt`
- `updatedAt`

Milestone 2 uses this existing table.

No new tables are required for Milestone 2.

Implemented constraints and behavior:

- One contractor may have one active offer per job request for MVP simplicity.
- Editing an offer updates price, completion time, and optional message.
- Offers cannot be created for closed, completed, or expired jobs.
- Offers cannot be created by employers.
- Offers cannot be created by suspended users.
- Withdrawn offers are soft-deleted with `deletedAt` and hidden from employer offer lists.

If unlimited offers per contractor per job are required later, remove the unique contractor/job constraint before launch. For this MVP milestone, one offer per contractor per job is easier to reason about and avoids spam.

## API Endpoints

Job browsing for contractors:

- `GET /api/v1/jobs`

Query filters:

- `category`
- `subcategory`
- `location`

Offer creation and editing:

- `POST /api/v1/jobs/:jobId/offers`
- `PATCH /api/v1/offers/:offerId`
- `GET /api/v1/offers/mine`
- `POST /api/v1/offers/:offerId/withdraw`

Employer offer viewing:

- `GET /api/v1/jobs/:jobId/offers`
- `POST /api/v1/offers/:offerId/select`

Admin offer viewing:

- `GET /api/v1/offers`
- `GET /api/v1/offers/:offerId`

## Authorization Rules

Contractor:

- Can browse active jobs.
- Can create offers on active jobs.
- Can edit only their own offers.
- Can withdraw only their own offers.
- Cannot create, edit, renew, or delete job requests.
- Cannot see employer contact details.

Employer:

- Can view offers only for their own job requests.
- Can see pre-unlock offer fields only.
- Can select one preferred offer for their own job request.
- Cannot create contractor offers.

Admin:

- Can view all jobs and all offers.
- Can see full contractor and employer details.

## Offer Visibility Rules

Before unlock, employers see:

- estimated price
- estimated completion time
- contractor average rating
- contractor total reviews

Before unlock, employers do not see:

- contractor name
- contractor email
- contractor phone
- contractor profile details
- contractor company name
- contractor avatar

Before unlock, contractors do not see:

- employer email
- employer phone
- private employer profile details

Admins see full details.

Offer ordering:

- Offers returned to employers should be randomly ordered.
- Random ordering must happen server-side.

## Mobile Screens

Contractor:

- Browse Jobs
- Job Details
- Submit Offer
- Edit Offer
- My Offers

Employer:

- Job Details with offers section
- Offer list with masked contractor identity

Admin:

- No admin panel implementation in this milestone.

## DTO Validation

Create offer:

- `estimatedPrice`: required, positive decimal
- `estimatedCompletionDays`: required, integer, minimum 1
- `message`: optional, max 1500 characters

Update offer:

- `estimatedPrice`: optional, positive decimal
- `estimatedCompletionDays`: optional, integer, minimum 1
- `message`: optional, max 1500 characters

Job filters:

- `category`: optional string
- `subcategory`: optional string
- `location`: optional string

## Error Handling

Return clear errors for:

- contractor attempting to offer on inactive job
- employer attempting to create an offer
- contractor editing another contractor's offer
- employer viewing offers for another employer's job
- duplicate offer by the same contractor on the same job
- invalid price or completion time

## Acceptance Criteria

- Contractor can browse active job requests.
- Contractor can filter jobs by category, subcategory, and location.
- Contractor can submit an offer for an active job.
- Contractor can edit their own offer.
- Contractor can withdraw their own offer.
- Contractor cannot create or manage employer job requests.
- Employer can see offers on their own job requests.
- Employer cannot see contractor identity before unlock.
- Employer cannot view offers for another employer's job.
- Employer can select one preferred offer.
- Offers are returned in random order for employers.
- Admin can view all offers.
- Backend validates every offer request.
- Backend enforces every permission rule.
- Mobile app supports contractor browse and offer submission flow.
- Mobile app supports employer masked offer display.

## Verification Plan

Backend checks:

- Register/login contractor.
- Register/login employer.
- Contractor browses active jobs.
- Contractor creates offer.
- Contractor edits own offer.
- Contractor cannot edit another contractor's offer.
- Contractor withdraws own offer.
- Employer views offers for own job.
- Employer cannot view offers for another employer's job.
- Employer response hides contractor identity.
- Employer selects offer.
- Admin response includes full offer details.

Smoke command after API is running:

```bash
npm run smoke:milestone2 --workspace @malta-marketplace/api
```

Mobile checks:

- Contractor account lands on job browsing workflow.
- Contractor can open job details and submit offer.
- Contractor can see and edit own offers.
- Employer can open job details and see masked offers.
- No contact details appear before unlock.
