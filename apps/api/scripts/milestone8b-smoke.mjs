import { existsSync, readFileSync } from 'node:fs';
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
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} failed with ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function requestMaybe(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  return {
    status: response.status,
    payload: await response.json().catch(() => null),
  };
}

async function registerContractor(label) {
  return request('/auth/register', {
    method: 'POST',
    body: {
      email: `m8b.${label}.${suffix}@malta.test`,
      password: 'Password123!',
      role: 'CONTRACTOR',
      displayName: `Milestone 8B ${label}`,
      location: 'Malta',
    },
  });
}

async function ensureStoreProducts() {
  const packages = await prisma.tokenPackage.findMany({
    where: { title: { in: ['Starter', 'Professional', 'Business'] } },
  });
  const byTitle = new Map(packages.map((tokenPackage) => [tokenPackage.title, tokenPackage]));
  const mappings = [
    ['Starter', 'maltapro_tokens_5'],
    ['Professional', 'maltapro_tokens_20'],
    ['Business', 'maltapro_tokens_50'],
  ];

  for (const [title, platformProductId] of mappings) {
    const tokenPackage = byTitle.get(title);

    if (!tokenPackage) {
      throw new Error(`Missing seeded token package ${title}.`);
    }

    await prisma.storeProduct.upsert({
      where: {
        platform_platformProductId: {
          platform: 'REVENUECAT',
          platformProductId,
        },
      },
      create: {
        platform: 'REVENUECAT',
        platformProductId,
        tokenPackageId: tokenPackage.id,
        isActive: true,
      },
      update: {
        tokenPackageId: tokenPackage.id,
        isActive: true,
      },
    });
  }

  console.info('OK RevenueCat product mapping exists');
  return byTitle.get('Starter');
}

function revenueCatHeaders() {
  return process.env.REVENUECAT_WEBHOOK_SECRET
    ? { Authorization: `Bearer ${process.env.REVENUECAT_WEBHOOK_SECRET}` }
    : {};
}

function revenueCatPayload(input) {
  return {
    event: {
      id: input.eventId,
      type: input.type ?? 'NON_RENEWING_PURCHASE',
      app_user_id: input.userId,
      product_id: input.productId,
      transaction_id: input.transactionId ?? `rc_tx_${input.eventId}`,
      price: input.price ?? 9.99,
      currency: 'EUR',
    },
  };
}

async function main() {
  const rootEnvExample = readFileSync(resolve(process.cwd(), '../../.env.example'), 'utf8');
  const apiEnvExample = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8');
  if (/STRIPE_/i.test(rootEnvExample) || /STRIPE_/i.test(apiEnvExample)) {
    throw new Error('Stripe variables are still present in active env examples.');
  }
  console.info('OK Stripe env vars are not required in active env examples');

  await request('/health');
  console.info('OK API starts without Stripe-specific runtime checks');

  const contractor = await registerContractor('contractor');
  const starter = await ensureStoreProducts();

  const paymentConfig = await request('/payments/config', { token: contractor.accessToken });
  if (!['MOCK', 'REVENUECAT', 'UNCONFIGURED'].includes(paymentConfig.mode)) {
    throw new Error(`Unexpected purchase config mode: ${JSON.stringify(paymentConfig)}`);
  }
  if ('stripeConfigured' in paymentConfig) {
    throw new Error('Payment config still exposes stripeConfigured.');
  }
  console.info(`OK purchase config is Stripe-free (${paymentConfig.mode})`);

  if (paymentConfig.mockPurchasesEnabled) {
    const beforeMock = await request('/tokens/balance', { token: contractor.accessToken });
    const mockPurchase = await request('/tokens/mock-purchase', {
      method: 'POST',
      token: contractor.accessToken,
      body: { tokenPackageId: starter.id },
    });
    if (mockPurchase.balance.balance !== beforeMock.balance + starter.tokenCount) {
      throw new Error('Mock purchase did not update token balance.');
    }
    console.info('OK mock purchase works when ALLOW_MOCK_PURCHASES=true');
  } else if (paymentConfig.mode === 'UNCONFIGURED') {
    if (paymentConfig.purchasesConfigured !== false) {
      throw new Error('Unconfigured purchase mode should report purchasesConfigured=false.');
    }
    const disabledMock = await requestMaybe('/tokens/mock-purchase', {
      method: 'POST',
      token: contractor.accessToken,
      body: { tokenPackageId: starter.id },
    });
    if (disabledMock.status !== 410) {
      throw new Error('Mock purchase should be disabled when mock mode is off.');
    }
    console.info('OK mock disabled and RevenueCat missing reports purchases not configured');
  }

  const checkout = await requestMaybe('/payments/create-checkout-session', {
    method: 'POST',
    token: contractor.accessToken,
    body: { tokenPackageId: starter.id },
  });
  if (checkout.status !== 410) {
    throw new Error('Stripe checkout endpoint should be inactive.');
  }
  console.info('OK Stripe checkout is not active');

  const beforeWebhook = await request('/tokens/balance', { token: contractor.accessToken });
  const eventId = `rc_event_m8b_${suffix}`;
  const webhookResult = await request('/purchases/revenuecat/webhook', {
    method: 'POST',
    headers: revenueCatHeaders(),
    body: revenueCatPayload({
      eventId,
      userId: contractor.user.id,
      productId: 'maltapro_tokens_5',
    }),
  });
  if (!webhookResult.granted) {
    throw new Error(`RevenueCat webhook did not grant tokens: ${JSON.stringify(webhookResult)}`);
  }

  const afterWebhook = await request('/tokens/balance', { token: contractor.accessToken });
  if (afterWebhook.balance !== beforeWebhook.balance + starter.tokenCount) {
    throw new Error('RevenueCat webhook did not update wallet balance.');
  }
  console.info('OK RevenueCat webhook with valid product grants tokens');
  console.info('OK wallet balance updates');

  const duplicateWebhook = await request('/purchases/revenuecat/webhook', {
    method: 'POST',
    headers: revenueCatHeaders(),
    body: revenueCatPayload({
      eventId,
      userId: contractor.user.id,
      productId: 'maltapro_tokens_5',
    }),
  });
  const afterDuplicate = await request('/tokens/balance', { token: contractor.accessToken });
  if (!duplicateWebhook.duplicate || afterDuplicate.balance !== afterWebhook.balance) {
    throw new Error('Duplicate RevenueCat webhook granted tokens twice.');
  }
  console.info('OK duplicate RevenueCat webhook is idempotent');

  const transactions = await request('/tokens/transactions?page=1&limit=100', { token: contractor.accessToken });
  if (!transactions.data.some((transaction) => transaction.externalRef === eventId || transaction.description.includes('RevenueCat purchase'))) {
    throw new Error('RevenueCat purchase token transaction was not recorded.');
  }
  console.info('OK token ledger remains correct');

  const payments = await request('/payments?limit=100', { token: contractor.accessToken });
  const purchaseRecord = payments.data.find((payment) => payment.revenueCatEventId === eventId);
  if (!purchaseRecord || purchaseRecord.provider !== 'REVENUECAT' || purchaseRecord.status !== 'COMPLETED') {
    throw new Error('RevenueCat purchase record was not created correctly.');
  }
  console.info('OK purchase transaction is created');

  const unknownProductResult = await request('/purchases/revenuecat/webhook', {
    method: 'POST',
    headers: revenueCatHeaders(),
    body: revenueCatPayload({
      eventId: `rc_unknown_product_${suffix}`,
      userId: contractor.user.id,
      productId: `unknown_product_${suffix}`,
    }),
  });
  const afterUnknownProduct = await request('/tokens/balance', { token: contractor.accessToken });
  if (!unknownProductResult.ignored || afterUnknownProduct.balance !== afterDuplicate.balance) {
    throw new Error('Unknown RevenueCat product was not ignored safely.');
  }
  console.info('OK unknown product is ignored safely');

  const unknownUserResult = await request('/purchases/revenuecat/webhook', {
    method: 'POST',
    headers: revenueCatHeaders(),
    body: revenueCatPayload({
      eventId: `rc_unknown_user_${suffix}`,
      userId: '00000000-0000-4000-8000-000000000000',
      productId: 'maltapro_tokens_5',
    }),
  });
  if (!unknownUserResult.ignored) {
    throw new Error('Unknown RevenueCat user was not handled safely.');
  }
  console.info('OK unknown user is handled safely');

  console.info('Milestone 8B smoke test passed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
