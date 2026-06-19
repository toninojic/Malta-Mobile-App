# AI Job Assistant

## Purpose

AI Job Assistant helps employers turn a natural-language job description into a structured MaltaPro job draft. It does not replace manual job creation and never publishes automatically.

## Access

Only `EMPLOYER` users can use the assistant. Contractors, admins, and logged-out users cannot access the endpoints or see the floating button.

## Environment

Backend only:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
AI_DAILY_MESSAGE_LIMIT=20
AI_ASSISTANT_MOCK=false
```

The mobile app never receives an OpenAI key. If `OPENAI_API_KEY` is missing and mock mode is off, the API returns:

```text
AI assistant is currently unavailable.
```

## Daily Limit

Each employer gets 20 user messages per UTC day by default. AI responses do not count. The count is stored in `AiUsage` and resets at UTC midnight.

## Draft Rules

AI drafts contain only:

- title
- description
- categoryKey
- subcategoryKey
- locationKey

AI must use existing service categories and Malta locations. If required fields are unclear, it should ask a follow-up question instead of guessing.

## Publish Flow

Publishing an AI draft calls the same backend job creation service as manual job creation. This means:

- normal job validation runs
- a normal `JobRequest` is created
- the AI draft is marked `PUBLISHED`
- the AI conversation is marked `COMPLETED`
- existing nearby contractor push notification logic runs

## Discard Flow

Discarding marks the draft and conversation as discarded. It does not create a job and does not send notifications.

## Cost Controls

- Backend-only OpenAI calls
- 500-character max user message
- 20 user messages per employer per UTC day
- 15-second OpenAI request timeout
- allowed category/location validation
- unavailable state when OpenAI is not configured
- optional `AI_ASSISTANT_MOCK=true` for smoke testing without real OpenAI calls

## Testing

Run the API, then:

```bash
npm run smoke:ai-job-assistant --workspace @malta-marketplace/api
```

For full draft/publish smoke coverage without OpenAI, start the API with:

```env
AI_ASSISTANT_MOCK=true
```

Checklist:

- employer can start conversation
- contractor/admin receive `403`
- message length over 500 is rejected
- missing OpenAI key shows unavailable
- draft uses valid category/location
- publish creates a normal job
- nearby contractor notification is created
- discard does not create a job
