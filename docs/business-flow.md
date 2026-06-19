# MaltaPro Business Flow

## Employer Job Creation

Employers can create job requests manually from the existing Create Job form.

Employers can also use AI Job Assistant as an optional drafting path:

1. Employer opens the floating AI button.
2. Employer describes the job in natural language.
3. AI asks follow-up questions when required details are missing.
4. AI creates a structured draft.
5. Employer can edit manually, discard, or publish.
6. Publishing uses the same backend job creation service as manual creation.

AI never publishes automatically. The employer must confirm publishing.

## Contractor Discovery

When a job is created manually or from AI publish, the normal nearby matching path runs. Contractors with matching service location/category preferences can receive `NEW_JOB_NEARBY` notifications when their preferences allow it.

## Privacy

AI drafts do not include contact details, prices, contractor recommendations, or private user data. OpenAI calls are made only by the backend API.
