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
      email: `m10.${label}.${suffix}@malta.test`,
      password: 'Password123!',
      role,
      displayName: `Milestone 10 ${label}`,
      phone: '+356 9900 1000',
      location: role === 'CONTRACTOR' ? 'Sliema' : 'Valletta',
      companyName: role === 'CONTRACTOR' ? `M10 ${label} Trades` : undefined,
      tradeCategories: role === 'CONTRACTOR' ? ['Plumbing'] : [],
    },
  });
}

async function waitForNotification(token, type, expectedCount = 1) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const notifications = await request('/notifications?limit=100', { token });
    const matched = notifications.data.filter((notification) => notification.type === type);
    if (matched.length >= expectedCount) {
      return matched;
    }
    await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 150));
  }

  throw new Error(`Timed out waiting for ${type} notification.`);
}

async function createJob(employer, label) {
  return request('/jobs', {
    method: 'POST',
    token: employer.accessToken,
    body: {
      title: `Milestone 10 ${label} pipe job`,
      description: 'Nearby job alert smoke test.',
      category: 'plumbing',
      subcategory: 'pipe_installation',
      location: 'Sliema',
      imageUrls: [],
    },
  });
}

const admin = await request('/auth/login', {
  method: 'POST',
  body: { email: 'admin@malta.test', password: 'Password123!' },
});
const employer = await register('EMPLOYER', 'employer');
const contractor = await register('CONTRACTOR', 'contractor');

await expectStatus('invalid Expo token rejection', 400, () =>
  request('/push-tokens', {
    method: 'POST',
    token: contractor.accessToken,
    body: {
      expoPushToken: 'not-a-token',
      platform: 'android',
    },
  }),
);

const pushToken = `ExponentPushToken[m10${suffix}]`;
await request('/push-tokens', {
  method: 'POST',
  token: contractor.accessToken,
  body: {
    expoPushToken: pushToken,
    platform: 'android',
    deviceId: 'm10-device',
    deviceName: 'Milestone 10 Android',
  },
});
await request('/push-tokens', {
  method: 'POST',
  token: contractor.accessToken,
  body: {
    expoPushToken: pushToken,
    platform: 'android',
    deviceId: 'm10-device',
    deviceName: 'Milestone 10 Android Updated',
  },
});

const myTokens = await request('/push-tokens/mine', { token: contractor.accessToken });
const matchingTokens = myTokens.filter((token) => token.expoPushToken === pushToken);
if (matchingTokens.length !== 1) {
  throw new Error('Duplicate push token registration should upsert one active row.');
}
console.info('OK duplicate push token upsert');

const adminTokens = await request('/admin/push-tokens?limit=100', { token: admin.accessToken });
if (!adminTokens.data.some((token) => token.expoPushToken === pushToken)) {
  throw new Error('Admin push token visibility failed.');
}
console.info('OK admin push token visibility');

const defaultPreferences = await request('/notifications/preferences', { token: contractor.accessToken });
if (!defaultPreferences.newJobsNearMe || !defaultPreferences.messages || !defaultPreferences.offerUpdates) {
  throw new Error('Contractor default notification preferences are not enabled as expected.');
}
console.info('OK default notification preferences');

await request('/contractors/me/service-areas', {
  method: 'PATCH',
  token: contractor.accessToken,
  body: { locations: ['Sliema'] },
});
await request('/contractors/me/service-categories', {
  method: 'PATCH',
  token: contractor.accessToken,
  body: {
    categories: [{ categoryKey: 'plumbing', subcategoryKey: 'pipe_installation' }],
  },
});
console.info('OK contractor service matching preferences saved');

await request('/notifications/preferences', {
  method: 'PATCH',
  token: contractor.accessToken,
  body: { newJobsNearMe: false },
});
await createJob(employer, 'opt-out');
await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 600));
let notifications = await request('/notifications?limit=100', { token: contractor.accessToken });
if (notifications.data.some((notification) => notification.type === 'NEW_JOB_NEARBY')) {
  throw new Error('Opted-out contractor should not receive nearby job notification.');
}
console.info('OK nearby job opt-out');

await request('/notifications/preferences', {
  method: 'PATCH',
  token: contractor.accessToken,
  body: { newJobsNearMe: true },
});
const job = await createJob(employer, 'opt-in');
const nearbyNotifications = await waitForNotification(contractor.accessToken, 'NEW_JOB_NEARBY');
const latestNearby = nearbyNotifications[0];
if (latestNearby.metadata?.jobId !== job.id || latestNearby.metadata?.target !== 'jobDetails') {
  throw new Error('Nearby job notification metadata should deep link to the created job.');
}
console.info('OK nearby job alert and metadata');

await request(`/push-tokens/${matchingTokens[0].id}`, {
  method: 'DELETE',
  token: contractor.accessToken,
});
const afterDelete = await request('/push-tokens/mine', { token: contractor.accessToken });
if (afterDelete.find((token) => token.id === matchingTokens[0].id)?.isActive !== false) {
  throw new Error('Push token deactivation failed.');
}
console.info('OK push token deactivation');

await expectStatus('contractor-only service endpoint protection', 403, () =>
  request('/contractors/me/service-areas', {
    token: employer.accessToken,
  }),
);

console.info('Milestone 10 smoke test passed.');

