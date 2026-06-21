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

async function main() {
  const admin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@malta.test', password: 'Password123!' },
  });

  const anonymous = await request('/analytics/events', {
    method: 'POST',
    body: {
      sessionId: `anon-${suffix}`,
      eventName: 'LOGIN_VIEWED',
      screen: 'Login',
      metadata: { source: 'smoke' },
      platform: 'smoke',
      appVersion: '0.1.0',
    },
  });
  if (anonymous.userId !== null || anonymous.eventName !== 'LOGIN_VIEWED') {
    throw new Error('Anonymous analytics event was not stored correctly.');
  }
  console.info('OK anonymous analytics event can be created');

  const contractor = await request('/auth/register', {
    method: 'POST',
    body: {
      email: `analytics.contractor.${suffix}@malta.test`,
      password: 'Password123!',
      role: 'CONTRACTOR',
      displayName: 'Analytics Contractor',
      location: 'Sliema',
      companyName: 'Analytics Trades',
      tradeCategories: ['Plumbing'],
      termsAccepted: true,
      privacyAccepted: true,
    },
  });

  const event = await request('/analytics/events', {
    method: 'POST',
    token: contractor.accessToken,
    body: {
      sessionId: `contractor-${suffix}`,
      eventName: 'MESSAGE_SENT',
      screen: 'ConversationThread',
      entityType: 'CONVERSATION',
      entityId: 'conversation-smoke',
      metadata: {
        messageBody: 'this should not be stored',
        categoryKey: 'plumbing',
      },
      platform: 'android',
      appVersion: '0.1.0',
    },
  });
  if (event.role !== 'CONTRACTOR' || event.metadata.messageBody !== '[redacted]') {
    throw new Error('Authenticated analytics event did not sanitize metadata.');
  }
  console.info('OK authenticated analytics event is stored and sanitized');

  const batch = await request('/analytics/events/batch', {
    method: 'POST',
    token: contractor.accessToken,
    body: {
      events: [
        {
          sessionId: `batch-${suffix}`,
          eventName: 'OFFER_CREATE_FAILED',
          screen: 'OfferForm',
          metadata: { reason: 'smoke' },
          platform: 'android',
          appVersion: '0.1.0',
        },
        {
          sessionId: `batch-${suffix}`,
          eventName: 'JOB_DETAILS_VIEWED',
          screen: 'JobDetails',
          entityType: 'JOB',
          entityId: 'job-smoke',
          platform: 'android',
          appVersion: '0.1.0',
        },
      ],
    },
  });
  if (batch.created !== 2) {
    throw new Error('Analytics batch did not create two events.');
  }
  console.info('OK analytics batch works');

  const overview = await request('/admin/analytics/overview', { token: admin.accessToken });
  if (!overview.totalEvents || !Array.isArray(overview.mostViewedScreens)) {
    throw new Error('Admin analytics overview response is invalid.');
  }
  console.info('OK admin analytics overview works');

  const funnels = await request('/admin/analytics/funnels', { token: admin.accessToken });
  if (!Array.isArray(funnels.employer) || !Array.isArray(funnels.contractor)) {
    throw new Error('Admin analytics funnels response is invalid.');
  }
  console.info('OK admin analytics funnels work');

  const errors = await request('/admin/analytics/errors', { token: admin.accessToken });
  if (errors.counts.failedOfferCreation < 1) {
    throw new Error('Admin analytics errors did not include failed offer creation.');
  }
  console.info('OK admin analytics errors work');

  console.info('Analytics smoke test passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
