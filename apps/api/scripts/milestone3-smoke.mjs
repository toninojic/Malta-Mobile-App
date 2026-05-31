import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

for (const envFile of ['.env', 'apps/api/.env', '../../.env']) {
  const envPath = resolve(process.cwd(), envFile);
  if (existsSync(envPath)) {
    config({ path: envPath, override: false });
  }
}

const API_URL = process.env.API_URL ?? 'http://localhost:3000/api/v1';
const suffix = Date.now();
const prisma = new PrismaClient();

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
      email: `m3.${label}.${suffix}@malta.test`,
      password: 'Password123!',
      role,
      displayName: `Milestone 3 ${label}`,
      location: 'Malta',
    },
  });
}

async function main() {
  const password = 'Password123!';
  const contractor = await register('CONTRACTOR', 'contractor');
  const employer = await register('EMPLOYER', 'employer');
  const suspended = await register('CONTRACTOR', 'suspended');
  const insufficient = await register('CONTRACTOR', 'insufficient');
  const admin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@malta.test', password },
  });

  const packages = await request('/tokens/packages', { token: contractor.accessToken });
  if (!Array.isArray(packages) || packages.length < 3) {
    throw new Error('Package listing did not return seeded packages.');
  }
  const seedExpectations = [
    ['Starter', 5, 9.99],
    ['Professional', 20, 29.99],
    ['Business', 50, 59.99],
  ];
  for (const [title, tokenCount, price] of seedExpectations) {
    const tokenPackage = packages.find((item) => item.title === title);
    if (!tokenPackage || tokenPackage.tokenCount !== tokenCount || Number(tokenPackage.price) !== price) {
      throw new Error(`Seed package ${title} is missing or has incorrect values.`);
    }
  }
  console.info('OK package listing works');
  console.info('OK token package seed data exists');

  await expectStatus('non-admin cannot create token package', 403, () =>
    request('/admin/tokens/packages', {
      method: 'POST',
      token: contractor.accessToken,
      body: {
        title: `Forbidden ${suffix}`,
        tokenCount: 1,
        price: 1,
      },
    }),
  );

  const smokePackage = await request('/admin/tokens/packages', {
    method: 'POST',
    token: admin.accessToken,
    body: {
      title: `Smoke Package ${suffix}`,
      tokenCount: 3,
      price: 1.23,
      currency: 'EUR',
    },
  });
  console.info('OK admin can create token package');

  await request(`/admin/tokens/packages/${smokePackage.id}`, {
    method: 'PATCH',
    token: admin.accessToken,
    body: { isActive: false },
  });

  await expectStatus('inactive package cannot be purchased', 400, () =>
    request('/tokens/mock-purchase', {
      method: 'POST',
      token: contractor.accessToken,
      body: { tokenPackageId: smokePackage.id },
    }),
  );

  await request(`/admin/tokens/packages/${smokePackage.id}`, {
    method: 'PATCH',
    token: admin.accessToken,
    body: { isActive: true },
  });
  console.info('OK admin can edit token package');

  const purchase = await request('/tokens/mock-purchase', {
    method: 'POST',
    token: contractor.accessToken,
    body: { tokenPackageId: smokePackage.id },
  });
  if (purchase.balance.balance !== 3 || purchase.transaction.type !== 'PURCHASE') {
    throw new Error('Mock purchase did not update balance and transaction.');
  }
  console.info('OK mock purchase works and tokens are added');

  const transactions = await request('/tokens/transactions?page=1&limit=20', {
    token: contractor.accessToken,
  });
  if (!transactions.data.some((transaction) => transaction.id === purchase.transaction.id)) {
    throw new Error('Transaction history did not include purchase.');
  }
  console.info('OK transaction history records purchase');

  const refund = await request('/tokens/refunds', {
    method: 'POST',
    token: contractor.accessToken,
    body: {
      tokenTransactionId: purchase.transaction.id,
      reason: 'Smoke test refund request reason.',
    },
  });
  if (refund.status !== 'PENDING' || refund.amount !== 3) {
    throw new Error('Refund request did not persist as pending.');
  }
  console.info('OK refund request creation works');

  await expectStatus('duplicate refund request is rejected', 409, () =>
    request('/tokens/refunds', {
      method: 'POST',
      token: contractor.accessToken,
      body: {
        tokenTransactionId: purchase.transaction.id,
        reason: 'Duplicate smoke test refund request.',
      },
    }),
  );

  await request(`/admin/tokens/refunds/${refund.id}/reject`, {
    method: 'POST',
    token: admin.accessToken,
    body: { adminNote: 'Rejected by smoke test.' },
  });
  const balanceAfterRejectedRefund = await request('/tokens/balance', {
    token: contractor.accessToken,
  });
  if (balanceAfterRejectedRefund.balance !== 3) {
    throw new Error(`Rejected refund should not change balance, got ${balanceAfterRejectedRefund.balance}.`);
  }
  console.info('OK refund rejection works');
  console.info('OK refund rejection does not change balance');

  const secondPurchase = await request('/tokens/mock-purchase', {
    method: 'POST',
    token: contractor.accessToken,
    body: { tokenPackageId: smokePackage.id },
  });

  const secondRefund = await request('/tokens/refunds', {
    method: 'POST',
    token: contractor.accessToken,
    body: {
      tokenTransactionId: secondPurchase.transaction.id,
      reason: 'Approve this smoke test refund.',
    },
  });

  const approved = await request(`/admin/tokens/refunds/${secondRefund.id}/approve`, {
    method: 'POST',
    token: admin.accessToken,
    body: { adminNote: 'Approved by smoke test.' },
  });
  if (approved.status !== 'APPROVED') {
    throw new Error('Refund approval did not persist.');
  }
  console.info('OK refund approval works');

  const insufficientPurchase = await request('/tokens/mock-purchase', {
    method: 'POST',
    token: insufficient.accessToken,
    body: { tokenPackageId: smokePackage.id },
  });
  await prisma.userTokenBalance.update({
    where: { userId: insufficient.user.id },
    data: { balance: 0 },
  });
  const insufficientRefund = await request('/tokens/refunds', {
    method: 'POST',
    token: insufficient.accessToken,
    body: {
      tokenTransactionId: insufficientPurchase.transaction.id,
      reason: 'Smoke test insufficient balance refund.',
    },
  });
  await expectStatus('refund approval cannot make balance negative', 400, () =>
    request(`/admin/tokens/refunds/${insufficientRefund.id}/approve`, {
      method: 'POST',
      token: admin.accessToken,
      body: { adminNote: 'Should fail due to insufficient balance.' },
    }),
  );

  const balance = await request('/tokens/balance', {
    token: contractor.accessToken,
  });
  if (balance.balance !== 3) {
    throw new Error(`Balance should be 3 after one rejected and one approved refund, got ${balance.balance}.`);
  }
  console.info('OK balance updates and never goes negative');

  const historyAfterRefund = await request('/tokens/transactions?page=1&limit=100', {
    token: contractor.accessToken,
  });
  if (!historyAfterRefund.data.some((transaction) => transaction.type === 'REFUND' && transaction.amount === -3)) {
    throw new Error('Refund transaction was not recorded.');
  }
  console.info('OK transaction history records refund');

  const myRefunds = await request('/tokens/refunds/mine?page=1&limit=20', {
    token: contractor.accessToken,
  });
  if (myRefunds.pagination.page !== 1 || myRefunds.data.length < 2) {
    throw new Error('My refund pagination did not return expected data.');
  }
  console.info('OK refund pagination works');

  const adminRefunds = await request('/admin/tokens/refunds?page=1&limit=100', {
    token: admin.accessToken,
  });
  if (!adminRefunds.data.some((item) => item.id === approved.id && item.requestedBy)) {
    throw new Error('Admin refunds did not include full refund details.');
  }
  console.info('OK admin refund listing works');

  const employerPurchase = await request('/tokens/mock-purchase', {
    method: 'POST',
    token: employer.accessToken,
    body: { tokenPackageId: smokePackage.id },
  });
  if (employerPurchase.balance.balance !== 3) {
    throw new Error('Employer mock purchase did not work.');
  }
  console.info('OK employer can use wallet flow');

  const suspendedPurchase = await request('/tokens/mock-purchase', {
    method: 'POST',
    token: suspended.accessToken,
    body: { tokenPackageId: smokePackage.id },
  });
  await prisma.user.update({
    where: { id: suspended.user.id },
    data: { status: 'SUSPENDED' },
  });
  await expectStatus('suspended user cannot purchase tokens', 401, () =>
    request('/tokens/mock-purchase', {
      method: 'POST',
      token: suspended.accessToken,
      body: { tokenPackageId: smokePackage.id },
    }),
  );
  await expectStatus('suspended user cannot request refunds', 401, () =>
    request('/tokens/refunds', {
      method: 'POST',
      token: suspended.accessToken,
      body: {
        tokenTransactionId: suspendedPurchase.transaction.id,
        reason: 'Suspended users should not refund.',
      },
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
