# Mobile QA Fixes

## Final QA Safety Fixes

- Contractor offer messages are checked on the backend during create and edit. Obvious phone numbers, emails, contact links, social/contact URLs, and contact phrases such as "call me", "text me", "whatsapp me", "viber me", and "email me" are rejected with: "Contact details are not allowed in offers. Contact unlock is available after token payment."
- Contractor job/work details hide contractor portfolio images when the signed-in user is the contractor. Job images remain visible. Employer offer views can still show contractor portfolio images before contact unlock.
- The RevenueCat diagnostics panel was removed from the wallet UI. RevenueCat configuration and console diagnostics remain available for development/debugging without exposing a debug box to users.
