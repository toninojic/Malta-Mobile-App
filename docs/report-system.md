# Report System

MaltaPro now has a manual safety and moderation flow. Users can report problematic marketplace content, and admins review reports before taking any action.

## Reportable Targets

- `USER`: employer or contractor profile.
- `JOB`: employer job request.
- `OFFER`: contractor offer on an employer job.
- `CONVERSATION`: unlocked chat thread.
- `MESSAGE`: individual chat message.
- `REVIEW`: contractor or employer review.

## Reasons

- Spam
- Scam or fraud
- Harassment
- Inappropriate content
- Fake profile
- Trying to bypass contact unlock
- Payment issue
- Other

`Other` requires a description. Descriptions are capped at 1500 characters.

## User Flow

Users can create reports from job details, offer/work details, contractor profiles, conversations, message long-press, and review details. Reports are private: the reported user does not see who reported them.

Users can view their submitted reports in Profile -> My Reports. They see target summary, reason, status, creation date, and admin note when one is provided.

## Admin Moderation Flow

Admin Moderation has a Reports queue with filters for status, target type, and reason.

Admins can:

- Mark a report under review.
- Resolve a report.
- Dismiss a report.
- Suspend or activate a reported user.
- Close a reported job.
- Remove a reported review.
- Soft-hide a reported message.

No automatic bans or automatic content removal are performed. Admin decisions are manual.

## Rate Limits And Duplicate Protection

- A user can submit up to 10 reports per 24 hours.
- The same reporter cannot create another pending or under-review report for the same target.
- Suspended users cannot create reports.
- Users cannot report themselves or their own content where that would be unsafe.

## Audit Logs

Audit logs are created for:

- Report marked under review.
- Report resolved.
- Report dismissed.
- User suspended from a report.
- User activated from a report.
- Job closed from a report.
- Review removed from a report.
- Message hidden from a report.

## Notifications

- Admins receive `NEW_REPORT` when a report is submitted.
- Reporters receive `REPORT_STATUS_UPDATED` when an admin changes report status.
- Push notification preferences route `NEW_REPORT` through admin alerts and report status updates through system alerts.

## Not Automated

This release does not include AI moderation, automatic bans, email verification, or automatic report escalation.
