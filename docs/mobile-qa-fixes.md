# Mobile QA Fixes

## Report System

- Job details include Report Job for contractors.
- Employer offer cards include Report Offer.
- Offer / Work Details includes contextual reporting: employers can report the offer; contractors can report the job and report the employer from the employer info modal.
- Contractor profile includes Report Contractor.
- Conversations include Report Conversation.
- Long-pressing another user's message opens a Report Message modal.
- Review details include Report Review when the current user is not the review author.
- Profile includes My Reports.
- Admin Moderation includes a Reports queue.

## Contact Detail Blocking

Offer and message submissions are rejected when obvious contact information is detected. Normal prices and durations should still pass.

## Privacy Checks

- Users can see only their own reports.
- Admins can see all reports.
- Reported users do not see reporter identity.
- Contractor verification documents are not exposed through reports.

## Smoke Test

Run:

```bash
npm run smoke:report-system --workspace @malta-marketplace/api
```
