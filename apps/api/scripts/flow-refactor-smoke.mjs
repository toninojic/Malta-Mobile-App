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
      email: `flow.${label}.${suffix}@malta.test`,
      password: 'Password123!',
      role,
      displayName: `Flow ${label}`,
      location: 'Malta',
      companyName: role === 'CONTRACTOR' ? `Flow ${label} Trades` : undefined,
      tradeCategories: role === 'CONTRACTOR' ? ['Electrical'] : [],
    },
  });
}

async function createJob(employer, label) {
  return request('/jobs', {
    method: 'POST',
    token: employer.accessToken,
    body: {
      title: `Flow ${label} job`,
      description: 'Flow refactor smoke test job with enough detail for validation.',
      category: 'electrical',
      subcategory: 'repairs',
      location: 'Sliema, Malta',
      imageUrls: [],
    },
  });
}

async function createOffer(contractor, jobId) {
  return request(`/jobs/${jobId}/offers`, {
    method: 'POST',
    token: contractor.accessToken,
    body: {
      estimatedPrice: 150,
      estimatedCompletionDays: 3,
      message: 'I can handle this job this week.',
    },
  });
}

const employer = await register('EMPLOYER', 'employer');
const contractor = await register('CONTRACTOR', 'contractor');
const packages = await request('/tokens/packages', { token: contractor.accessToken });
await request('/tokens/mock-purchase', {
  method: 'POST',
  token: contractor.accessToken,
  body: { tokenPackageId: packages[0].id },
});

const job = await createJob(employer, 'main');
console.info('OK employer creates job');

const offer = await createOffer(contractor, job.id);
console.info('OK contractor sends offer');

const employerNotifications = await request('/notifications', { token: employer.accessToken });
if (!employerNotifications.data.some((notification) => notification.type === 'NEW_OFFER')) {
  throw new Error('Employer did not receive NEW_OFFER notification.');
}
console.info('OK employer receives NEW_OFFER notification');

const selected = await request(`/offers/${offer.id}/select`, {
  method: 'POST',
  token: employer.accessToken,
});
if (selected.status !== 'SELECTED' || selected.unlockStatus !== 'PENDING' || !selected.contactId) {
  throw new Error('Selected offer did not create a locked contact unlock.');
}
console.info('OK employer selects offer and contact remains locked');

const selectedJob = await request(`/jobs/${job.id}`, { token: employer.accessToken });
if (selectedJob.status !== 'IN_PROGRESS') {
  throw new Error(`Expected job IN_PROGRESS, got ${selectedJob.status}.`);
}
console.info('OK job becomes IN_PROGRESS');

const contractorNotifications = await request('/notifications', { token: contractor.accessToken });
if (!contractorNotifications.data.some((notification) => notification.type === 'OFFER_SELECTED')) {
  throw new Error('Contractor did not receive OFFER_SELECTED notification.');
}
console.info('OK contractor receives OFFER_SELECTED notification');

const contractorOfferBeforeUnlock = await request(`/offers/mine`, { token: contractor.accessToken });
const selectedBeforeUnlock = contractorOfferBeforeUnlock.data.find((item) => item.id === offer.id);
if (selectedBeforeUnlock.employer) {
  throw new Error('Employer identity leaked before unlock.');
}
console.info('OK contractor cannot see employer contact before unlock');

const balanceBefore = await request('/tokens/balance', { token: contractor.accessToken });
const unlock = await request(`/offers/${offer.id}/unlock`, {
  method: 'POST',
  token: contractor.accessToken,
});
if (unlock.contact.status !== 'UNLOCKED') {
  throw new Error('Contact did not become UNLOCKED.');
}
const balanceAfter = await request('/tokens/balance', { token: contractor.accessToken });
if (balanceAfter.balance !== balanceBefore.balance - 1) {
  throw new Error('Unlock did not spend exactly 1 token.');
}
const transactions = await request('/tokens/transactions', { token: contractor.accessToken });
if (!transactions.data.some((transaction) => transaction.type === 'SPEND' && transaction.amount === -1)) {
  throw new Error('SPEND transaction was not created.');
}
console.info('OK contractor unlocks using 1 token and SPEND transaction exists');

const conversation = await request(`/conversations/contacts/${unlock.contact.id}`, {
  method: 'POST',
  token: contractor.accessToken,
});
const sameConversation = await request(`/conversations/contacts/${unlock.contact.id}`, {
  method: 'POST',
  token: employer.accessToken,
});
if (conversation.id !== sameConversation.id) {
  throw new Error('Conversation was duplicated for the same contact unlock.');
}
console.info('OK conversation is created or reused by contactUnlockId');

await request(`/conversations/${conversation.id}/messages`, {
  method: 'POST',
  token: contractor.accessToken,
  body: { content: 'Hello from the flow smoke test.' },
});
const messages = await request(`/conversations/${conversation.id}/messages`, { token: employer.accessToken });
if (!messages.some((message) => message.content.includes('flow smoke test'))) {
  throw new Error('Previous messages did not load.');
}
console.info('OK previous messages load');

await request(`/contacts/${unlock.contact.id}/complete`, {
  method: 'POST',
  token: contractor.accessToken,
});
console.info('OK contractor marks job completed');

await request(`/contacts/${unlock.contact.id}/confirm-completion`, {
  method: 'POST',
  token: employer.accessToken,
});
const completedJob = await request(`/jobs/${job.id}`, { token: employer.accessToken });
if (completedJob.status !== 'COMPLETED') {
  throw new Error(`Expected job COMPLETED, got ${completedJob.status}.`);
}
console.info('OK employer confirms completion and job becomes COMPLETED');

const completionStatus = await request(`/contacts/${unlock.contact.id}/completion-status`, { token: employer.accessToken });
if (!completionStatus.canReview) {
  throw new Error('Review was not available after confirmed completion.');
}
console.info('OK review becomes available');

await request(`/contacts/${unlock.contact.id}/review`, {
  method: 'POST',
  token: employer.accessToken,
  body: { rating: 5, comment: 'Great work.' },
});
console.info('OK employer leaves review');

const closedJob = await createJob(employer, 'closed');
const closedOffer = await createOffer(contractor, closedJob.id);
const selectedClosedOffer = await request(`/offers/${closedOffer.id}/select`, {
  method: 'POST',
  token: employer.accessToken,
});
await request(`/offers/${closedOffer.id}/unlock`, {
  method: 'POST',
  token: contractor.accessToken,
});
await request(`/jobs/${closedJob.id}`, {
  method: 'DELETE',
  token: employer.accessToken,
});
await expectStatus('closed job cannot be reviewed', 400, () =>
  request(`/contacts/${selectedClosedOffer.contactId}/review`, {
    method: 'POST',
    token: employer.accessToken,
    body: { rating: 5 },
  }),
);
const closedJobAfter = await request(`/jobs/${closedJob.id}`, { token: employer.accessToken });
if (closedJobAfter.status !== 'CLOSED') {
  throw new Error('Closed job did not remain CLOSED.');
}
console.info('OK closed job does not count as completed');
