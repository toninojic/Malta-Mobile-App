# Business Flow Notes

This document records high-level marketplace behavior that affects QA and release checks.

## Contact Unlock Integrity

Contractors cannot include obvious contact details in offer messages or chat messages. Backend validation blocks phone numbers, email addresses, contact links, and phrases such as "call me", "text me", "WhatsApp me", or "email me".

Blocked message:

`Contact details are not allowed in offers. Contact unlock is available after token payment.`

## Reports And Moderation

Users can report jobs, users, offers, conversations, messages, and reviews. Reports go to the Admin Moderation queue and are private to the reporter and admins.

Admins manually review every report. MaltaPro does not auto-ban users or auto-remove content based only on a report.

## Admin Actions

From report review, admins can manually suspend or activate users, close jobs, remove reviews, or soft-hide messages. Every moderation action creates an audit log.
