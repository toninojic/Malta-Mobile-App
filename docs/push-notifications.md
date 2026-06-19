# Push Notifications Notes

## Report Notifications

The report system adds two notification types:

- `NEW_REPORT`: sent to active admins when a user submits a report.
- `REPORT_STATUS_UPDATED`: sent to the reporter when an admin marks the report under review, resolved, or dismissed.

## Preferences

- `NEW_REPORT` uses the admin alerts preference.
- `REPORT_STATUS_UPDATED` uses the system alerts preference.

## Deep Links

- Admin report pushes open the Admin Moderation tab.
- Reporter status update pushes open My Reports.

## Cache Refresh

Report push events invalidate:

- notifications
- activity summary
- user reports
- admin reports
