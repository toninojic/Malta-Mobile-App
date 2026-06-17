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
const WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET?.trim();
const prisma = new PrismaClient();

const EXACT_REVENUECAT_PAYLOAD = {
  api_version: '1.0',
  event: {
    aliases: ['137e92fc-e620-48be-9b13-d07860770396'],
    app_id: 'appabce0b3eef',
    app_user_id: '137e92fc-e620-48be-9b13-d07860770396',
    original_app_user_id: '137e92fc-e620-48be-9b13-d07860770396',
    product_id: 'maltapro_tokens_5',
    transaction_id: 'GPA.3333-8986-9532-13423',
    original_transaction_id: 'GPA.3333-8986-9532-13423',
    type: 'NON_RENEWING_PURCHASE',
    store: 'PLAY_STORE',
    environment: 'PRODUCTION',
    price: 0.98,
    price_in_purchased_currency: 99,
    currency: 'RSD',
  },
};
const EMAIL_FALLBACK_REVENUECAT_PAYLOAD = {
  api_version: '1.0',
  event: {
    app_user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    original_app_user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    product_id: 'maltapro_tokens_5',
    transaction_id: 'GPA.EMAIL-FALLBACK-9532-13423',
    original_transaction_id: 'GPA.EMAIL-FALLBACK-9532-13423',
    type: 'NON_RENEWING_PURCHASE',
    store: 'PLAY_STORE',
    environment: 'PRODUCTION',
    price: 0.98,
    price_in_purchased_currency: 99,
    currency: 'RSD',
    subscriber_attributes: {
      $email: {
        value: 'revenuecat-smoke@malta.test',
      },
    },
  },
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(WEBHOOK_SECRET ? { Authorization: `Bearer ${WEBHOOK_SECRET}` } : {}),
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

async function ensureRevenueCatProducts() {
  const packageSpecs = [
    { title: 'Starter', tokenCount: 5, price: 9.99, productId: 'maltapro_tokens_5' },
    { title: 'Professional', tokenCount: 20, price: 29.99, productId: 'maltapro_tokens_20' },
    { title: 'Business', tokenCount: 50, price: 59.99, productId: 'maltapro_tokens_50' },
  ];

  for (const spec of packageSpecs) {
    const tokenPackage = await prisma.tokenPackage.upsert({
      where: { title: spec.title },
      create: {
        title: spec.title,
        tokenCount: spec.tokenCount,
        price: spec.price,
        currency: 'EUR',
        isActive: true,
      },
      update: {
        tokenCount: spec.tokenCount,
        price: spec.price,
        currency: 'EUR',
        isActive: true,
      },
    });

    await prisma.storeProduct.upsert({
      where: {
        platform_platformProductId: {
          platform: 'REVENUECAT',
          platformProductId: spec.productId,
        },
      },
      create: {
        platform: 'REVENUECAT',
        platformProductId: spec.productId,
        tokenPackageId: tokenPackage.id,
        isActive: true,
      },
      update: {
        tokenPackageId: tokenPackage.id,
        isActive: true,
      },
    });
  }
}

async function prepareExactPayloadUser() {
  const userId = EXACT_REVENUECAT_PAYLOAD.event.app_user_id;
  const transactionIds = [
    EXACT_REVENUECAT_PAYLOAD.event.transaction_id,
    EMAIL_FALLBACK_REVENUECAT_PAYLOAD.event.transaction_id,
  ];

  await prisma.payment.deleteMany({
    where: {
      OR: [
        { revenueCatEventId: { in: transactionIds } },
        { revenueCatTransactionId: { in: transactionIds } },
      ],
    },
  });
  await prisma.tokenTransaction.deleteMany({
    where: {
      userId,
      externalRef: { in: transactionIds },
    },
  });

  const user = await prisma.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      email: 'revenuecat-smoke@malta.test',
      passwordHash: 'not-used-by-revenuecat-smoke',
      role: 'CONTRACTOR',
      status: 'ACTIVE',
    },
    update: {
      role: 'CONTRACTOR',
      status: 'ACTIVE',
    },
    select: { email: true },
  });

  EMAIL_FALLBACK_REVENUECAT_PAYLOAD.event.subscriber_attributes.$email.value = user.email;

  await prisma.userTokenBalance.upsert({
    where: { userId },
    create: { userId, balance: 0 },
    update: { balance: 0, version: { increment: 1 } },
  });
}

async function getBalance() {
  const wallet = await prisma.userTokenBalance.findUnique({
    where: { userId: EXACT_REVENUECAT_PAYLOAD.event.app_user_id },
  });

  return wallet?.balance ?? 0;
}

async function main() {
  await ensureRevenueCatProducts();
  await prepareExactPayloadUser();

  const before = await getBalance();
  const first = await request('/purchases/revenuecat/webhook', {
    method: 'POST',
    body: EXACT_REVENUECAT_PAYLOAD,
  });
  const afterFirst = await getBalance();

  assert(first.received === true, 'Webhook should be received.');
  assert(first.ignored !== true, `Webhook should not be ignored: ${JSON.stringify(first)}`);
  assert(first.granted === true, `Webhook should grant tokens: ${JSON.stringify(first)}`);
  assert(first.tokensGranted === 5, `maltapro_tokens_5 should credit 5 tokens: ${JSON.stringify(first)}`);
  assert(afterFirst === before + 5, `Wallet should increase by 5 tokens. Before=${before} After=${afterFirst}`);
  console.info('OK exact RevenueCat NON_RENEWING_PURCHASE payload credits 5 tokens');

  const second = await request('/purchases/revenuecat/webhook', {
    method: 'POST',
    body: EXACT_REVENUECAT_PAYLOAD,
  });
  const afterSecond = await getBalance();

  assert(second.received === true, 'Duplicate webhook should be received.');
  assert(second.duplicate === true, `Duplicate webhook should be detected: ${JSON.stringify(second)}`);
  assert(afterSecond === afterFirst, `Duplicate webhook must not credit twice. First=${afterFirst} Second=${afterSecond}`);
  console.info('OK duplicate RevenueCat transaction_id does not credit twice');

  const payment = await prisma.payment.findFirst({
    where: { revenueCatTransactionId: EXACT_REVENUECAT_PAYLOAD.event.transaction_id },
  });
  assert(payment?.userId === EXACT_REVENUECAT_PAYLOAD.event.app_user_id, 'Payment should be linked to backend User.id.');
  assert(payment?.platformProductId === 'maltapro_tokens_5', 'Payment should store the RevenueCat product id.');
  console.info('OK RevenueCat app_user_id maps to backend User.id and product mapping is stored');

  const beforeFallback = await getBalance();
  const fallback = await request('/purchases/revenuecat/webhook', {
    method: 'POST',
    body: EMAIL_FALLBACK_REVENUECAT_PAYLOAD,
  });
  const afterFallback = await getBalance();

  assert(fallback.received === true, 'Email fallback webhook should be received.');
  assert(fallback.ignored !== true, `Email fallback webhook should not be ignored: ${JSON.stringify(fallback)}`);
  assert(fallback.granted === true, `Email fallback webhook should grant tokens: ${JSON.stringify(fallback)}`);
  assert(fallback.tokensGranted === 5, `Email fallback maltapro_tokens_5 should credit 5 tokens: ${JSON.stringify(fallback)}`);
  assert(afterFallback === beforeFallback + 5, `Email fallback should increase wallet by 5 tokens. Before=${beforeFallback} After=${afterFallback}`);
  console.info('OK RevenueCat subscriber email fallback credits the matched backend user');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
