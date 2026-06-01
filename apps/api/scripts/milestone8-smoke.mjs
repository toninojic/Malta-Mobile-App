import { createHmac } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PaymentStatus, PrismaClient } from '@prisma/client';

for (const envFile of ['.env', 'apps/api/.env', '../../.env']) {
  const envPath = resolve(process.cwd(), envFile);
  if (existsSync(envPath)) {
    config({ path: envPath, override: false });
  }
}

const API_URL = process.env.API_URL ?? 'http://localhost:3000/api/v1';
const WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET || (process.env.NODE_ENV === 'production' ? undefined : 'whsec_milestone8_local_dev');
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

async function requestMaybe(path, options = {}) {
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
  return { response, payload };
}

async function webhook(payload, signature = signPayload(payload)) {
  const response = await fetch(`${API_URL}/payments/webhook`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'stripe-signature': signature,
    },
    body: payload,
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`POST /payments/webhook failed with ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
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
      email: `m8.${label}.${suffix}@malta.test`,
      password: 'Password123!',
      role,
      displayName: `Milestone 8 ${label}`,
      location: 'Malta',
      companyName: role === 'CONTRACTOR' ? `M8 ${label} Trades` : undefined,
      tradeCategories: role === 'CONTRACTOR' ? ['Electrical'] : undefined,
    },
  });
}

function signPayload(payload) {
  if (!WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET must be configured for webhook smoke testing in production.');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', WEBHOOK_SECRET).update(`${timestamp}.`).update(payload).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

function checkoutCompletedPayload({ paymentId, checkoutSessionId, userId, tokenPackageId }) {
  return JSON.stringify({
    id: `evt_m8_completed_${suffix}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: checkoutSessionId,
        payment_intent: `pi_m8_paid_${suffix}`,
        metadata: {
          paymentId,
          userId,
          tokenPackageId,
        },
      },
    },
  });
}

function paymentFailedPayload({ paymentId, paymentIntentId }) {
  return JSON.stringify({
    id: `evt_m8_failed_${suffix}`,
    type: 'payment_intent.payment_failed',
    data: {
      object: {
        id: paymentIntentId,
        metadata: { paymentId },
        last_payment_error: {
          message: 'Your test card was declined.',
        },
      },
    },
  });
}

async function createPendingPayment(contractorUserId, tokenPackage) {
  const checkoutSessionId = `cs_test_m8_${suffix}`;
  const payment = await prisma.payment.create({
    data: {
      userId: contractorUserId,
      tokenPackageId: tokenPackage.id,
      amount: tokenPackage.price,
      currency: tokenPackage.currency,
      status: PaymentStatus.PENDING,
      stripeCheckoutSessionId: checkoutSessionId,
    },
  });

  return { paymentId: payment.id, checkoutSessionId };
}

async function createCheckoutOrSeedPayment(contractor, tokenPackage) {
  const result = await requestMaybe('/payments/create-checkout-session', {
    method: 'POST',
    token: contractor.accessToken,
    body: { tokenPackageId: tokenPackage.id },
  });

  if (result.response.ok) {
    if (!result.payload?.checkoutUrl || !result.payload?.paymentId) {
      throw new Error('Checkout session response is missing checkoutUrl or paymentId.');
    }

    const payment = await prisma.payment.findUnique({
      where: { id: result.payload.paymentId },
    });

    if (!payment?.stripeCheckoutSessionId) {
      throw new Error('Created checkout payment is missing Stripe checkout session id.');
    }

    console.info('OK Stripe checkout session creation works');
    return { paymentId: payment.id, checkoutSessionId: payment.stripeCheckoutSessionId };
  }

  if (result.response.status === 503) {
    console.info('OK checkout session endpoint requires Stripe test keys; seeding pending payment for webhook smoke');
    return createPendingPayment(contractor.user.id, tokenPackage);
  }

  throw new Error(`Checkout session failed unexpectedly: ${result.response.status} ${JSON.stringify(result.payload)}`);
}

async function main() {
  const contractor = await register('CONTRACTOR', 'contractor');
  const otherContractor = await register('CONTRACTOR', 'other.contractor');
  const employer = await register('EMPLOYER', 'employer');
  const admin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@malta.test', password: 'Password123!' },
  });

  await expectStatus('anonymous payments are protected', 401, () => request('/payments'));

  const packages = await request('/tokens/packages', { token: contractor.accessToken });
  const starter = packages.find((tokenPackage) => tokenPackage.title === 'Starter') ?? packages[0];
  if (!starter) {
    throw new Error('No active token package found.');
  }
  console.info('OK token package seed data exists');

  await expectStatus('employers cannot create checkout sessions', 403, () =>
    request('/payments/create-checkout-session', {
      method: 'POST',
      token: employer.accessToken,
      body: { tokenPackageId: starter.id },
    }),
  );

  await expectStatus('mock purchases are disabled', 410, () =>
    request('/tokens/mock-purchase', {
      method: 'POST',
      token: contractor.accessToken,
      body: { tokenPackageId: starter.id },
    }),
  );

  const balanceBefore = await request('/tokens/balance', { token: contractor.accessToken });
  const { paymentId, checkoutSessionId } = await createCheckoutOrSeedPayment(contractor, starter);

  const otherPayments = await request('/payments?limit=100', { token: otherContractor.accessToken });
  if (otherPayments.data.some((payment) => payment.id === paymentId)) {
    throw new Error('Payments endpoint leaked another user payment.');
  }
  console.info('OK own payment listing only');

  const badPayload = checkoutCompletedPayload({
    paymentId,
    checkoutSessionId,
    userId: contractor.user.id,
    tokenPackageId: starter.id,
  });
  await expectStatus('bad webhook signature is rejected', 400, () =>
    webhook(badPayload, `t=${Math.floor(Date.now() / 1000)},v1=bad`),
  );

  await webhook(badPayload);
  const paidPayment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (paidPayment.status !== PaymentStatus.PAID) {
    throw new Error(`Webhook did not mark payment paid. Got ${paidPayment.status}.`);
  }
  console.info('OK checkout.session.completed marks payment paid');

  const balanceAfterPaid = await request('/tokens/balance', { token: contractor.accessToken });
  if (balanceAfterPaid.balance !== balanceBefore.balance + starter.tokenCount) {
    throw new Error(`Webhook did not add purchased tokens. Got balance ${balanceAfterPaid.balance}.`);
  }
  console.info('OK webhook grants tokens');

  const transactions = await request('/tokens/transactions?limit=20', { token: contractor.accessToken });
  const purchase = transactions.data.find(
    (transaction) => transaction.type === 'PURCHASE' && transaction.amount === starter.tokenCount,
  );
  if (!purchase) {
    throw new Error('Purchase token transaction was not created.');
  }
  console.info('OK purchase transaction created');

  await webhook(badPayload);
  const balanceAfterDuplicate = await request('/tokens/balance', { token: contractor.accessToken });
  if (balanceAfterDuplicate.balance !== balanceAfterPaid.balance) {
    throw new Error('Duplicate checkout webhook granted tokens twice.');
  }
  console.info('OK duplicate checkout webhook is idempotent');

  const failedPaymentIntentId = `pi_m8_failed_${suffix}`;
  const failedPayment = await prisma.payment.create({
    data: {
      userId: contractor.user.id,
      tokenPackageId: starter.id,
      amount: starter.price,
      currency: starter.currency,
      status: PaymentStatus.PENDING,
      stripePaymentIntentId: failedPaymentIntentId,
    },
  });

  await webhook(paymentFailedPayload({ paymentId: failedPayment.id, paymentIntentId: failedPaymentIntentId }));
  const failedPaymentAfterWebhook = await prisma.payment.findUniqueOrThrow({ where: { id: failedPayment.id } });
  if (failedPaymentAfterWebhook.status !== PaymentStatus.FAILED || !failedPaymentAfterWebhook.failureReason) {
    throw new Error('Failed payment webhook did not record failure state.');
  }
  const balanceAfterFailure = await request('/tokens/balance', { token: contractor.accessToken });
  if (balanceAfterFailure.balance !== balanceAfterPaid.balance) {
    throw new Error('Failed payment changed token balance.');
  }
  console.info('OK payment_intent.payment_failed does not grant tokens');

  const payments = await request('/payments?limit=100', { token: contractor.accessToken });
  if (!payments.data.some((payment) => payment.id === paymentId && payment.status === 'PAID')) {
    throw new Error('Payment history did not include paid payment.');
  }
  console.info('OK payment history endpoint');

  const stats = await request('/admin/statistics', { token: admin.accessToken });
  if (!stats.payments || stats.payments.paid < 1 || stats.payments.failed < 1) {
    throw new Error('Admin statistics did not include payment metrics.');
  }
  console.info('OK admin payment statistics');

  console.info('Milestone 8 smoke test passed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
