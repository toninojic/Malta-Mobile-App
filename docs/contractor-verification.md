# Contractor Verification

This sprint adds contractor trust features without changing the marketplace business model or adding S3.

## Portfolio Images

- Contractors can upload up to 10 portfolio images.
- Allowed image types: jpg, jpeg, png, webp.
- Maximum size: 5MB per image.
- Images are stored locally under `uploads/portfolio`.
- Employers may see portfolio images before contact unlock.
- Portfolio images must not expose contractor phone/email/private contact fields.

## Verification Status

Contractor verification status values:

```text
UNVERIFIED
PENDING_REVIEW
VERIFIED
REJECTED
```

Contractors can upload a verification document when status is `UNVERIFIED` or `REJECTED`. A pending or verified request cannot be replaced from the app.

Allowed document types:

```text
jpg, jpeg, png, webp, pdf
```

Maximum size is 10MB. Documents are stored locally under `uploads/verification-documents`.

## Visibility

- Contractor can see only their verification status and admin note.
- Admin can see the uploaded document URL and review details.
- Employers cannot fetch verification documents.
- Verified contractors show a small check icon near their name.

## API

Contractor endpoints:

```text
GET  /api/v1/users/me/portfolio-images
POST /api/v1/users/me/portfolio-images
DELETE /api/v1/users/me/portfolio-images/:imageId

GET  /api/v1/users/me/contractor-verification
POST /api/v1/users/me/contractor-verification
```

Admin endpoints:

```text
GET  /api/v1/admin/contractor-verifications
GET  /api/v1/admin/contractor-verifications/:id
POST /api/v1/admin/contractor-verifications/:id/approve
POST /api/v1/admin/contractor-verifications/:id/reject
```

Admin approval creates:

- status `VERIFIED`
- contractor notification `CONTRACTOR_VERIFICATION_APPROVED`
- audit log `CONTRACTOR_VERIFICATION_APPROVED`

Admin rejection creates:

- status `REJECTED`
- stored `adminNote`
- contractor notification `CONTRACTOR_VERIFICATION_REJECTED`
- audit log `CONTRACTOR_VERIFICATION_REJECTED`

## Work Details

`GET /api/v1/offers/:offerId/work-details` returns contractor public trust fields:

- portfolio images
- rating summary
- verification status

It does not expose verification documents to employers.
