import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';

for (const envFile of ['.env', 'apps/api/.env', '../../.env']) {
  const envPath = resolve(process.cwd(), envFile);
  if (existsSync(envPath)) {
    config({ path: envPath, override: false });
  }
}

const API_URL = process.env.API_URL ?? 'http://localhost:3000/api/v1';
const suffix = Date.now();
const mockEnabled = ['true', '1', 'yes', 'on'].includes(String(process.env.AI_ASSISTANT_MOCK ?? '').toLowerCase());

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} failed with ${response.status}: ${JSON.stringify(payload)}`);
  }

  return payload;
}

async function expectStatus(label, status, fn) {
  try {
    await fn();
  } catch (error) {
    if (String(error.message).includes(` ${status}:`)) {
      console.info(`OK ${label}`);
      return;
    }

    throw error;
  }

  throw new Error(`${label} should have returned ${status}.`);
}

async function register(role, label) {
  return request('/auth/register', {
    method: 'POST',
    body: {
      email: `ai.${label}.${suffix}@malta.test`,
      password: 'Password123!',
      role,
      displayName: `AI ${label}`,
      location: role === 'CONTRACTOR' ? 'Sliema' : 'Valletta',
      companyName: role === 'CONTRACTOR' ? `AI ${label} Trades` : undefined,
      tradeCategories: role === 'CONTRACTOR' ? ['Plumbing'] : [],
    },
  });
}

async function waitForNotification(token, type) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const notifications = await request('/notifications?limit=100', { token });
    const matched = notifications.data.filter((notification) => notification.type === type);
    if (matched.length) {
      return matched[0];
    }
    await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 150));
  }

  throw new Error(`Timed out waiting for ${type} notification.`);
}

const employer = await register('EMPLOYER', 'employer');
const contractor = await register('CONTRACTOR', 'contractor');
const admin = await request('/auth/login', {
  method: 'POST',
  body: { email: 'admin@malta.test', password: 'Password123!' },
});

await expectStatus('contractor cannot use AI assistant', 403, () =>
  request('/ai/job-assistant/conversations', {
    method: 'POST',
    token: contractor.accessToken,
  }),
);
await expectStatus('admin cannot use AI assistant', 403, () =>
  request('/ai/job-assistant/conversations', {
    method: 'POST',
    token: admin.accessToken,
  }),
);

const current = await request('/ai/job-assistant/conversations/current', { token: employer.accessToken });
if (typeof current.remainingMessages !== 'number' || current.usage.limit < 1) {
  throw new Error('AI usage snapshot is missing.');
}
console.info('OK employer AI current state and usage');

const conversation = await request('/ai/job-assistant/conversations', {
  method: 'POST',
  token: employer.accessToken,
});
if (!conversation.conversation?.id) {
  throw new Error('AI conversation was not created.');
}
console.info('OK employer can start AI conversation');

await expectStatus('max message length is enforced', 400, () =>
  request('/ai/job-assistant/messages', {
    method: 'POST',
    token: employer.accessToken,
    body: {
      conversationId: conversation.conversation.id,
      message: 'x'.repeat(501),
    },
  }),
);

if (!mockEnabled) {
  if (!conversation.isAvailable) {
    await expectStatus('AI unavailable without backend provider', 503, () =>
      request('/ai/job-assistant/messages', {
        method: 'POST',
        token: employer.accessToken,
        body: {
          conversationId: conversation.conversation.id,
          message: 'Need pipe installation in Sliema.',
        },
      }),
    );
    console.info('OK AI unavailable state');
  } else {
    console.info('Skipping draft/publish checks to avoid calling real OpenAI. Set AI_ASSISTANT_MOCK=true on the API to run full smoke coverage.');
  }
  process.exit(0);
}

if (!conversation.isAvailable) {
  await expectStatus('AI unavailable without backend provider', 503, () =>
    request('/ai/job-assistant/messages', {
      method: 'POST',
      token: employer.accessToken,
      body: {
        conversationId: conversation.conversation.id,
        message: 'Need pipe installation in Sliema.',
      },
    }),
  );
  console.info('AI assistant unavailable checks passed. Start the API with AI_ASSISTANT_MOCK=true to run draft/publish smoke coverage.');
  process.exit(0);
}

const followUp = await request('/ai/job-assistant/messages', {
  method: 'POST',
  token: employer.accessToken,
  body: {
    conversationId: conversation.conversation.id,
    message: 'I need help at my apartment.',
  },
});
if (followUp.draft) {
  throw new Error('AI should ask follow-up questions when required fields are missing.');
}
console.info('OK AI asks follow-up when draft fields are missing');

const response = await request('/ai/job-assistant/messages', {
  method: 'POST',
  token: employer.accessToken,
  body: {
    conversationId: conversation.conversation.id,
    message: 'Need pipe installation in Sliema for a leaking bathroom pipe.',
  },
});
if (
  !response.draft ||
  response.draft.categoryKey !== 'plumbing' ||
  response.draft.subcategoryKey !== 'pipe_installation' ||
  response.draft.locationKey !== 'sliema'
) {
  throw new Error(`AI draft did not use valid expected category/location: ${JSON.stringify(response.draft)}`);
}
console.info('OK AI draft created with valid category and location');

await request('/contractors/me/service-areas', {
  method: 'PATCH',
  token: contractor.accessToken,
  body: [{ locationKey: 'sliema', locationLabel: 'Sliema' }],
});
await request('/contractors/me/service-categories', {
  method: 'PATCH',
  token: contractor.accessToken,
  body: [{ categoryKey: 'plumbing', subcategoryKey: 'pipe_installation' }],
});
await request('/notifications/preferences', {
  method: 'PATCH',
  token: contractor.accessToken,
  body: { newJobsNearMe: true },
});

const publish = await request(`/ai/job-assistant/draft/${response.draft.id}/publish`, {
  method: 'POST',
  token: employer.accessToken,
});
if (!publish.job?.id || publish.job.category !== 'plumbing') {
  throw new Error('Publishing AI draft did not create a normal job.');
}
const nearby = await waitForNotification(contractor.accessToken, 'NEW_JOB_NEARBY');
if (nearby.metadata?.jobId !== publish.job.id) {
  throw new Error('AI-published job did not trigger normal nearby job notification metadata.');
}
console.info('OK AI draft publish creates normal job and triggers nearby notification path');

const secondConversation = await request('/ai/job-assistant/conversations', {
  method: 'POST',
  token: employer.accessToken,
});
const secondDraftResponse = await request('/ai/job-assistant/messages', {
  method: 'POST',
  token: employer.accessToken,
  body: {
    conversationId: secondConversation.conversation.id,
    message: 'Need electrical wiring in Gzira for a new light fitting.',
  },
});
if (!secondDraftResponse.draft) {
  throw new Error('Second AI draft was not created.');
}
const beforeDiscardJobs = await request('/jobs/mine', { token: employer.accessToken });
await request(`/ai/job-assistant/draft/${secondDraftResponse.draft.id}/discard`, {
  method: 'POST',
  token: employer.accessToken,
});
const afterDiscardJobs = await request('/jobs/mine', { token: employer.accessToken });
if (afterDiscardJobs.length !== beforeDiscardJobs.length) {
  throw new Error('Discarding AI draft should not create a job.');
}
console.info('OK AI draft discard does not create job');

const limitConversation = await request('/ai/job-assistant/conversations', {
  method: 'POST',
  token: employer.accessToken,
});
let usage = await request('/ai/job-assistant/usage', { token: employer.accessToken });
while (usage.remainingMessages > 0) {
  await request('/ai/job-assistant/messages', {
    method: 'POST',
    token: employer.accessToken,
    body: {
      conversationId: limitConversation.conversation.id,
      message: 'Need plumbing in Sliema for pipe installation.',
    },
  });
  usage = await request('/ai/job-assistant/usage', { token: employer.accessToken });
}
await expectStatus('daily limit is enforced', 429, () =>
  request('/ai/job-assistant/messages', {
    method: 'POST',
    token: employer.accessToken,
    body: {
      conversationId: limitConversation.conversation.id,
      message: 'Need plumbing in Sliema for pipe installation.',
    },
  }),
);

console.info('AI Job Assistant smoke test passed.');
