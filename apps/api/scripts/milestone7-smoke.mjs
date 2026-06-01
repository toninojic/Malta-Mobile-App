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
      email: `m7.${label}.${suffix}@malta.test`,
      password: 'Password123!',
      role,
      displayName: `Milestone 7 ${label}`,
      phone: '+356 9900 7000',
      location: 'Malta',
      companyName: role === 'CONTRACTOR' ? `M7 ${label} Trades` : undefined,
      tradeCategories: role === 'CONTRACTOR' ? ['Electrical'] : [],
    },
  });
}

async function createJob(employer, label) {
  return request('/jobs', {
    method: 'POST',
    token: employer.accessToken,
    body: {
      title: `Milestone 7 ${label} job`,
      description: 'Smoke test job for admin moderation and statistics.',
      category: 'electrical',
      subcategory: 'repairs',
      location: 'Sliema, Malta',
      imageUrls: [],
    },
  });
}

async function createOffer(contractor, jobId, price = 140) {
  return request(`/jobs/${jobId}/offers`, {
    method: 'POST',
    token: contractor.accessToken,
    body: {
      estimatedPrice: price,
      estimatedCompletionDays: 2,
      message: 'Available for milestone 7 smoke test.',
    },
  });
}

async function buyTokens(contractor) {
  const packages = await request('/tokens/packages', { token: contractor.accessToken });
  const tokenPackage = packages.find((item) => item.title === 'Starter') ?? packages[0];
  if (!tokenPackage) {
    throw new Error('No token package found.');
  }

  return request('/tokens/mock-purchase', {
    method: 'POST',
    token: contractor.accessToken,
    body: { tokenPackageId: tokenPackage.id },
  });
}

async function createUnlockedConversation(employer, contractor) {
  const job = await createJob(employer, 'conversation');
  const offer = await createOffer(contractor, job.id);
  await request(`/offers/${offer.id}/select`, {
    method: 'POST',
    token: employer.accessToken,
  });
  await buyTokens(contractor);
  const unlock = await request(`/offers/${offer.id}/unlock`, {
    method: 'POST',
    token: contractor.accessToken,
  });
  const conversation = await request(`/conversations/contacts/${unlock.contact.id}`, {
    method: 'POST',
    token: contractor.accessToken,
  });
  await request(`/conversations/${conversation.id}/messages`, {
    method: 'POST',
    token: employer.accessToken,
    body: { content: 'Admin visibility smoke message.' },
  });

  return { job, offer, contact: unlock.contact, conversation };
}

async function createReviewForRemoval(employer, contractor) {
  const job = await createJob(employer, 'review');
  const offer = await createOffer(contractor, job.id, 220);
  await request(`/offers/${offer.id}/select`, {
    method: 'POST',
    token: employer.accessToken,
  });
  await buyTokens(contractor);
  const unlock = await request(`/offers/${offer.id}/unlock`, {
    method: 'POST',
    token: contractor.accessToken,
  });
  await request(`/contacts/${unlock.contact.id}/complete`, {
    method: 'POST',
    token: contractor.accessToken,
  });
  await request(`/contacts/${unlock.contact.id}/confirm-completion`, {
    method: 'POST',
    token: employer.accessToken,
  });

  return request(`/contacts/${unlock.contact.id}/review`, {
    method: 'POST',
    token: employer.accessToken,
    body: { rating: 5, comment: 'Admin moderation smoke review.' },
  });
}

async function latestAudit(token, action, entityId) {
  const logs = await request(`/admin/audit-logs?action=${encodeURIComponent(action)}&entityId=${encodeURIComponent(entityId)}&limit=20`, {
    token,
  });
  return logs.data[0];
}

const admin = await request('/auth/login', {
  method: 'POST',
  body: { email: 'admin@malta.test', password: 'Password123!' },
});
const employer = await register('EMPLOYER', 'employer');
const contractor = await register('CONTRACTOR', 'contractor');
const managedUser = await register('EMPLOYER', 'managed');

await expectStatus('non-admin access rejection', 403, () =>
  request('/admin/statistics', {
    token: employer.accessToken,
  }),
);

const statistics = await request('/admin/statistics', { token: admin.accessToken });
if (!statistics.users || !statistics.jobs || !statistics.tokens) {
  throw new Error('Statistics response is missing expected sections.');
}
console.info('OK statistics endpoint');

const users = await request('/admin/users?limit=20', { token: admin.accessToken });
if (!users.data.some((user) => user.id === managedUser.user.id)) {
  throw new Error('Admin user list did not include registered user.');
}
console.info('OK admin can list users');

const userDetails = await request(`/admin/users/${managedUser.user.id}`, { token: admin.accessToken });
if (userDetails.email !== managedUser.user.email) {
  throw new Error('Admin user details did not return requested user.');
}
console.info('OK admin can view user details');

await expectStatus('admin cannot suspend themselves', 400, () =>
  request(`/admin/users/${admin.user.id}/suspend`, {
    method: 'PATCH',
    token: admin.accessToken,
  }),
);

const suspended = await request(`/admin/users/${managedUser.user.id}/suspend`, {
  method: 'PATCH',
  token: admin.accessToken,
});
if (suspended.status !== 'SUSPENDED') {
  throw new Error('User suspension did not persist.');
}
if (!(await latestAudit(admin.accessToken, 'USER_SUSPENDED', managedUser.user.id))) {
  throw new Error('USER_SUSPENDED audit log was not created.');
}
console.info('OK user suspension and audit log');

const activated = await request(`/admin/users/${managedUser.user.id}/activate`, {
  method: 'PATCH',
  token: admin.accessToken,
});
if (activated.status !== 'ACTIVE') {
  throw new Error('User activation did not persist.');
}
if (!(await latestAudit(admin.accessToken, 'USER_ACTIVATED', managedUser.user.id))) {
  throw new Error('USER_ACTIVATED audit log was not created.');
}
console.info('OK user activation and audit log');

const closeJob = await createJob(employer, 'close');
const jobs = await request('/admin/jobs?limit=20', { token: admin.accessToken });
if (!jobs.data.some((job) => job.id === closeJob.id)) {
  throw new Error('Admin job list did not include new job.');
}
const jobDetails = await request(`/admin/jobs/${closeJob.id}`, { token: admin.accessToken });
if (jobDetails.id !== closeJob.id) {
  throw new Error('Admin job details did not return requested job.');
}
const closed = await request(`/admin/jobs/${closeJob.id}/close`, {
  method: 'PATCH',
  token: admin.accessToken,
});
if (closed.status !== 'CLOSED') {
  throw new Error('Admin job close did not persist.');
}
if (!(await latestAudit(admin.accessToken, 'JOB_CLOSED_BY_ADMIN', closeJob.id))) {
  throw new Error('JOB_CLOSED_BY_ADMIN audit log was not created.');
}
console.info('OK admin job close and audit log');

const offerJob = await createJob(employer, 'offer');
const offer = await createOffer(contractor, offerJob.id);
const adminOffers = await request(`/admin/offers?jobRequestId=${offerJob.id}`, { token: admin.accessToken });
if (!adminOffers.data.some((item) => item.id === offer.id)) {
  throw new Error('Admin offers list did not include offer.');
}
const adminOffer = await request(`/admin/offers/${offer.id}`, { token: admin.accessToken });
if (adminOffer.id !== offer.id || !adminOffer.contractor) {
  throw new Error('Admin offer details did not include offer data.');
}
console.info('OK admin can list and view offers');

const { contact, conversation } = await createUnlockedConversation(employer, contractor);
const contacts = await request(`/admin/contacts?jobRequestId=${contact.jobRequestId}`, { token: admin.accessToken });
if (!contacts.data.some((item) => item.id === contact.id)) {
  throw new Error('Admin contact list did not include unlocked contact.');
}
const contactDetails = await request(`/admin/contacts/${contact.id}`, { token: admin.accessToken });
if (contactDetails.id !== contact.id || contactDetails.status !== 'UNLOCKED') {
  throw new Error('Admin contact details did not return unlocked contact.');
}
console.info('OK admin contact unlock visibility');

const conversations = await request('/admin/conversations?limit=20', { token: admin.accessToken });
if (!conversations.data.some((item) => item.id === conversation.id)) {
  throw new Error('Admin conversations list did not include conversation.');
}
const conversationDetails = await request(`/admin/conversations/${conversation.id}`, { token: admin.accessToken });
const messages = await request(`/admin/conversations/${conversation.id}/messages`, { token: admin.accessToken });
if (!conversationDetails.messages?.length || !messages.some((message) => message.content.includes('Admin visibility'))) {
  throw new Error('Admin conversation message visibility failed.');
}
await expectStatus('admin cannot send admin messages', 403, () =>
  request(`/conversations/${conversation.id}/messages`, {
    method: 'POST',
    token: admin.accessToken,
    body: { content: 'Admin should not send this.' },
  }),
);
console.info('OK admin conversation visibility and send restriction');

await buyTokens(contractor);
const transactions = await request('/tokens/transactions?limit=20', { token: contractor.accessToken });
const purchaseA = transactions.data.find((transaction) => transaction.type === 'PURCHASE' && !transaction.relatedRefundRequestId);
if (!purchaseA) {
  throw new Error('No purchase transaction available for refund approval.');
}
const refundA = await request('/tokens/refunds', {
  method: 'POST',
  token: contractor.accessToken,
  body: { tokenTransactionId: purchaseA.id, reason: 'Milestone 7 approval smoke.' },
});
await request(`/admin/tokens/refunds/${refundA.id}/approve`, {
  method: 'POST',
  token: admin.accessToken,
  body: { adminNote: 'Approved by smoke.' },
});
if (!(await latestAudit(admin.accessToken, 'REFUND_APPROVED', refundA.id))) {
  throw new Error('REFUND_APPROVED audit log was not created.');
}
console.info('OK refund approval audit log');

await buyTokens(contractor);
const transactionsAfterSecondPurchase = await request('/tokens/transactions?limit=30', { token: contractor.accessToken });
const purchaseB = transactionsAfterSecondPurchase.data.find(
  (transaction) =>
    transaction.type === 'PURCHASE' &&
    transaction.id !== purchaseA.id &&
    !transaction.relatedRefundRequestId,
);
if (!purchaseB) {
  throw new Error('No purchase transaction available for refund rejection.');
}
const refundB = await request('/tokens/refunds', {
  method: 'POST',
  token: contractor.accessToken,
  body: { tokenTransactionId: purchaseB.id, reason: 'Milestone 7 rejection smoke.' },
});
await request(`/admin/tokens/refunds/${refundB.id}/reject`, {
  method: 'POST',
  token: admin.accessToken,
  body: { adminNote: 'Rejected by smoke.' },
});
if (!(await latestAudit(admin.accessToken, 'REFUND_REJECTED', refundB.id))) {
  throw new Error('REFUND_REJECTED audit log was not created.');
}
console.info('OK refund rejection audit log');

const review = await createReviewForRemoval(employer, contractor);
await request(`/admin/reviews/${review.id}/remove`, {
  method: 'PATCH',
  token: admin.accessToken,
});
if (!(await latestAudit(admin.accessToken, 'REVIEW_REMOVED', review.id))) {
  throw new Error('REVIEW_REMOVED audit log was not created.');
}
console.info('OK review removal audit log');

const auditLogs = await request('/admin/audit-logs?limit=20', { token: admin.accessToken });
if (!auditLogs.data.length) {
  throw new Error('Audit log listing returned no data.');
}
const auditDetails = await request(`/admin/audit-logs/${auditLogs.data[0].id}`, { token: admin.accessToken });
if (auditDetails.id !== auditLogs.data[0].id) {
  throw new Error('Audit log details did not return requested log.');
}
console.info('OK audit log listing and details');
