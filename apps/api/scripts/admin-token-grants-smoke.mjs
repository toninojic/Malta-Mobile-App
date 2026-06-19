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
const expectedWelcomeTokens = Number.isInteger(Number(process.env.WELCOME_BONUS_TOKENS))
  ? Number(process.env.WELCOME_BONUS_TOKENS)
  : 10;

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
      email: `admin-token-grants.${label}.${suffix}@malta.test`,
      password: 'Password123!',
      role,
      displayName: `Admin Token Grants ${label}`,
      location: 'Sliema',
      companyName: role === 'CONTRACTOR' ? `ATG ${label} Trades` : undefined,
      tradeCategories: role === 'CONTRACTOR' ? ['Plumbing'] : [],
    },
  });
}

function tokenMetric(stats, key) {
  return Number(stats?.tokens?.[key] ?? 0);
}

function assertAtLeast(label, actual, expected) {
  if (actual < expected) {
    throw new Error(`${label} expected at least ${expected}, got ${actual}.`);
  }
  console.info(`OK ${label}`);
}

function findTransaction(transactions, type, amount) {
  return transactions.data.find((transaction) => transaction.type === type && transaction.amount === amount);
}

async function main() {
  const admin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@malta.test', password: 'Password123!' },
  });
  const contractor = await register('CONTRACTOR', 'contractor');
  const employer = await register('EMPLOYER', 'employer');
  const skippedContractor = await register('CONTRACTOR', 'skipped');
  const statsBefore = await request('/admin/statistics', { token: admin.accessToken });

  await request('/tokens/welcome-bonus/skip', {
    method: 'POST',
    token: skippedContractor.accessToken,
  });
  const skippedClaim = await request('/tokens/welcome-bonus/claim', {
    method: 'POST',
    token: skippedContractor.accessToken,
  });
  if (skippedClaim.granted !== false) {
    throw new Error('Skipped contractor should not receive welcome bonus.');
  }
  console.info('OK skipped onboarding does not receive welcome bonus');

  const welcome = await request('/tokens/welcome-bonus/claim', {
    method: 'POST',
    token: contractor.accessToken,
  });
  if (!welcome.granted || welcome.transaction?.type !== 'WELCOME_BONUS' || welcome.transaction.amount !== expectedWelcomeTokens) {
    throw new Error(`Welcome bonus did not grant ${expectedWelcomeTokens} tokens.`);
  }
  console.info('OK welcome bonus granted after onboarding completion');

  const duplicateWelcome = await request('/tokens/welcome-bonus/claim', {
    method: 'POST',
    token: contractor.accessToken,
  });
  if (duplicateWelcome.granted || duplicateWelcome.balance.balance !== welcome.balance.balance) {
    throw new Error('Welcome bonus should be idempotent and not duplicate.');
  }
  console.info('OK welcome bonus does not duplicate');

  const defaultGrant = await request(`/admin/users/${contractor.user.id}/tokens/grant`, {
    method: 'POST',
    token: admin.accessToken,
    body: { reason: 'Launch promotion default grant.' },
  });
  if (defaultGrant.transaction.type !== 'ADMIN_GRANT' || defaultGrant.transaction.amount !== 10) {
    throw new Error('Default admin grant should create a 10-token ADMIN_GRANT transaction.');
  }
  console.info('OK admin default grant amount works');

  const customGrant = await request(`/admin/users/${contractor.user.id}/tokens/grant`, {
    method: 'POST',
    token: admin.accessToken,
    body: { amount: 7, reason: 'Custom promotion.' },
  });
  if (customGrant.transaction.type !== 'ADMIN_GRANT' || customGrant.transaction.amount !== 7) {
    throw new Error('Custom admin grant should create a matching ADMIN_GRANT transaction.');
  }
  console.info('OK admin custom grant amount works');

  await expectStatus('admin cannot grant tokens to employer', 400, () =>
    request(`/admin/users/${employer.user.id}/tokens/grant`, {
      method: 'POST',
      token: admin.accessToken,
      body: { amount: 10, reason: 'Should not be allowed.' },
    }),
  );

  const revoked = await request(`/admin/users/${contractor.user.id}/tokens/revoke`, {
    method: 'POST',
    token: admin.accessToken,
    body: { amount: 5, reason: 'Correction.' },
  });
  if (revoked.transaction.type !== 'ADMIN_REVOKE' || revoked.transaction.amount !== -5) {
    throw new Error('Admin revoke should create a negative ADMIN_REVOKE transaction.');
  }
  console.info('OK admin revoke works');

  await expectStatus('admin cannot revoke beyond balance', 400, () =>
    request(`/admin/users/${contractor.user.id}/tokens/revoke`, {
      method: 'POST',
      token: admin.accessToken,
      body: { amount: revoked.balance.balance + 1, reason: 'Should not be allowed.' },
    }),
  );

  const balance = await request('/tokens/balance', { token: contractor.accessToken });
  if (balance.balance !== expectedWelcomeTokens + 10 + 7 - 5) {
    throw new Error(`Unexpected contractor balance ${balance.balance}.`);
  }
  console.info('OK balance reflects welcome, grants, and revoke');

  const transactions = await request('/tokens/transactions?limit=100', { token: contractor.accessToken });
  if (!findTransaction(transactions, 'WELCOME_BONUS', expectedWelcomeTokens)) {
    throw new Error('Transaction history is missing WELCOME_BONUS.');
  }
  if (!findTransaction(transactions, 'ADMIN_GRANT', 10) || !findTransaction(transactions, 'ADMIN_GRANT', 7)) {
    throw new Error('Transaction history is missing ADMIN_GRANT entries.');
  }
  if (!findTransaction(transactions, 'ADMIN_REVOKE', -5)) {
    throw new Error('Transaction history is missing ADMIN_REVOKE.');
  }
  console.info('OK wallet transactions created for every balance change');

  const notifications = await request('/notifications?limit=100', { token: contractor.accessToken });
  for (const type of ['WELCOME_BONUS', 'ADMIN_GRANT', 'ADMIN_REVOKE']) {
    if (!notifications.data.some((notification) => notification.metadata?.type === type)) {
      throw new Error(`Notification metadata is missing ${type}.`);
    }
  }
  console.info('OK contractor notifications created');

  const grantAuditLogs = await request('/admin/audit-logs?action=TOKENS_ADMIN_GRANTED&limit=100', {
    token: admin.accessToken,
  });
  const revokeAuditLogs = await request('/admin/audit-logs?action=TOKENS_ADMIN_REVOKED&limit=100', {
    token: admin.accessToken,
  });
  if (!grantAuditLogs.data.some((log) => log.entityId === contractor.user.id)) {
    throw new Error('Admin grant audit log missing.');
  }
  if (!revokeAuditLogs.data.some((log) => log.entityId === contractor.user.id)) {
    throw new Error('Admin revoke audit log missing.');
  }
  console.info('OK audit logs created for admin grant/revoke');

  const statsAfter = await request('/admin/statistics', { token: admin.accessToken });
  assertAtLeast(
    'admin statistics include welcome bonus total',
    tokenMetric(statsAfter, 'welcomeBonusTokensGranted'),
    tokenMetric(statsBefore, 'welcomeBonusTokensGranted') + expectedWelcomeTokens,
  );
  assertAtLeast(
    'admin statistics include admin grant total',
    tokenMetric(statsAfter, 'adminGrantedTokens'),
    tokenMetric(statsBefore, 'adminGrantedTokens') + 17,
  );
  assertAtLeast(
    'admin statistics include admin revoke total',
    tokenMetric(statsAfter, 'adminRevokedTokens'),
    tokenMetric(statsBefore, 'adminRevokedTokens') + 5,
  );
  assertAtLeast(
    'admin statistics include promo total',
    tokenMetric(statsAfter, 'promoTokensGranted'),
    tokenMetric(statsBefore, 'promoTokensGranted') + expectedWelcomeTokens + 17,
  );

  console.info('Admin token grants smoke test passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
