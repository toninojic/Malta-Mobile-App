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

## Final Pre-Launch Legal Consent

- Employer and contractor registration require acceptance of the Terms of Use and Privacy Policy before account creation.
- The backend stores `termsAcceptedAt` and `privacyAcceptedAt` and rejects email/password registration or first-time Google signup without consent.
- Existing users logging in are not blocked by the new consent requirement.
- Legal links used during registration:
  - Terms of Use: https://maltaproapp.online/wp-content/uploads/2026/06/Terms-of-Use.pdf
  - Privacy Policy: https://maltaproapp.online/wp-content/uploads/2026/06/Privacy-Policy.pdf

## Profile Legal Links

Profile / Settings includes external links for:

- Privacy Policy: https://maltaproapp.online/wp-content/uploads/2026/06/Privacy-Policy.pdf
- Terms of Use: https://maltaproapp.online/wp-content/uploads/2026/06/Terms-of-Use.pdf
- Account Deletion Policy: https://maltaproapp.online/wp-content/uploads/2026/06/Account-Deletion-Policy.pdf
- Community Guidelines: https://maltaproapp.online/wp-content/uploads/2026/06/Community-Guidelines.pdf
- Contractor Verification Policy: https://maltaproapp.online/wp-content/uploads/2026/06/Contractor-Verification-Policy.pdf

## Registration Safe Padding

- Registration uses bottom safe-area padding so the consent checkbox and account creation actions are not glued to the device edge.
- The same spacing applies to employer and contractor registration.
