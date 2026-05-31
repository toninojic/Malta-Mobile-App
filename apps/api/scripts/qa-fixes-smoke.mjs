import { existsSync, readFileSync } from 'node:fs';
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
    if (String(error.message).includes(String(status))) {
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
      email: `qa.${label}.${suffix}@malta.test`,
      password: 'Password123!',
      role,
      displayName: `QA ${label}`,
      location: 'Malta',
      companyName: role === 'CONTRACTOR' ? `QA ${label} Trades` : undefined,
      tradeCategories: role === 'CONTRACTOR' ? ['Electrical'] : undefined,
    },
  });
}

async function createJob(employer, label, input = {}) {
  return request('/jobs', {
    method: 'POST',
    token: employer.accessToken,
    body: {
      title: `QA ${label} job`,
      description: 'Smoke test job for focused QA fixes in the mobile marketplace.',
      category: 'electrical',
      subcategory: 'repairs',
      location: 'Sliema, Malta',
      imageUrls: [],
      ...input,
    },
  });
}

async function createOffer(contractor, jobId, price = 120) {
  return request(`/jobs/${jobId}/offers`, {
    method: 'POST',
    token: contractor.accessToken,
    body: {
      estimatedPrice: price,
      estimatedCompletionDays: 2,
      message: 'QA smoke offer.',
    },
  });
}

async function buyStarterTokens(contractor) {
  const packages = await request('/tokens/packages', { token: contractor.accessToken });
  const starter = packages.find((tokenPackage) => tokenPackage.title === 'Starter') ?? packages[0];
  if (!starter) {
    throw new Error('No active token package available.');
  }

  return request('/tokens/mock-purchase', {
    method: 'POST',
    token: contractor.accessToken,
    body: { tokenPackageId: starter.id },
  });
}

function findNotification(notifications, type, metadataKey, metadataValue) {
  return notifications.data.find(
    (notification) =>
      notification.type === type &&
      notification.metadata &&
      notification.metadata[metadataKey] === metadataValue,
  );
}

function assertWalletIsTokenOnly() {
  const walletPath = resolve(process.cwd(), '../../apps/mobile/src/screens/wallet/WalletScreen.tsx');
  const source = readFileSync(walletPath, 'utf8');
  const forbidden = ['Contact Unlocks', 'Unlocked Contacts', 'My Reviews', 'Review Moderation'];
  const leaked = forbidden.find((text) => source.includes(text));
  if (leaked) {
    throw new Error(`Wallet still contains activity shortcut: ${leaked}`);
  }

  console.info('OK wallet screen remains token-only');
}

async function main() {
  const employer = await register('EMPLOYER', 'employer');
  const contractor = await register('CONTRACTOR', 'contractor');
  const admin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@malta.test', password: 'Password123!' },
  });

  await expectStatus('invalid category is rejected', 400, () =>
    createJob(employer, 'invalid-category', {
      category: 'invalid_category',
      subcategory: 'repairs',
    }),
  );
  await expectStatus('invalid subcategory is rejected', 400, () =>
    createJob(employer, 'invalid-subcategory', {
      category: 'electrical',
      subcategory: 'bathroom',
    }),
  );
  console.info('OK category validation works');

  const closeJob = await createJob(employer, 'close');
  const closed = await request(`/jobs/${closeJob.id}`, {
    method: 'DELETE',
    token: employer.accessToken,
  });
  if (closed.job.status !== 'CLOSED') {
    throw new Error(`Close job should return CLOSED status, got ${closed.job.status}.`);
  }
  console.info('OK employer can close active job');

  const employerJobs = await request('/jobs/mine', { token: employer.accessToken });
  if (!employerJobs.some((job) => job.id === closeJob.id && job.status === 'CLOSED')) {
    throw new Error('Closed job is not visible in employer jobs.');
  }
  console.info('OK closed job remains visible to employer');

  const contractorBrowse = await request('/jobs?category=electrical&location=Sliema&limit=100', {
    token: contractor.accessToken,
  });
  if (contractorBrowse.data.some((job) => job.id === closeJob.id)) {
    throw new Error('Closed job is visible to contractors.');
  }
  console.info('OK closed job is hidden from contractor browsing');

  await expectStatus('contractor cannot offer on closed job', 400, () => createOffer(contractor, closeJob.id, 70));

  const adminJobs = await request('/jobs/mine', { token: admin.accessToken });
  if (!adminJobs.some((job) => job.id === closeJob.id && job.status === 'CLOSED')) {
    throw new Error('Admin cannot see closed job.');
  }
  console.info('OK admin can still view closed job');

  const offerJob = await createJob(employer, 'offer-notification');
  const firstOffer = await createOffer(contractor, offerJob.id, 130);
  const notifications = await request('/notifications?limit=100', { token: employer.accessToken });
  const offerNotification = findNotification(notifications, 'NEW_OFFER', 'offerId', firstOffer.id);
  if (!offerNotification || offerNotification.body.includes(contractor.user.email)) {
    throw new Error('NEW_OFFER notification missing or leaked contractor identity.');
  }
  const unread = await request('/notifications/unread-count', { token: employer.accessToken });
  if (unread.count < 1) {
    throw new Error('NEW_OFFER did not increase unread notification count.');
  }
  console.info('OK NEW_OFFER notification is created without identity leak');

  await request(`/offers/${firstOffer.id}/withdraw`, {
    method: 'POST',
    token: contractor.accessToken,
  });
  const secondOffer = await createOffer(contractor, offerJob.id, 145);
  if (secondOffer.status !== 'PENDING') {
    throw new Error('New offer after withdrawal should be PENDING.');
  }
  console.info('OK contractor can create new offer after withdrawal');

  await expectStatus('contractor cannot create duplicate active offer', 409, () => createOffer(contractor, offerJob.id, 155));

  await buyStarterTokens(contractor);
  const unlock = await request(`/offers/${secondOffer.id}/unlock`, {
    method: 'POST',
    token: contractor.accessToken,
  });
  const sent = await request(`/conversations/${unlock.contact.id}/messages`, {
    method: 'POST',
    token: contractor.accessToken,
    body: { content: 'Hello, I can start tomorrow.' },
  });
  if (sent.conversation.contactUnlockId !== unlock.contact.id) {
    throw new Error('Unlock did not allow direct conversation access.');
  }
  console.info('OK unlock allows direct conversation access');

  assertWalletIsTokenOnly();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
