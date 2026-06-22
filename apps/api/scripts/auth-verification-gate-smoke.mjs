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
    const error = new Error(`${options.method ?? 'GET'} ${path} failed with ${response.status}: ${JSON.stringify(payload)}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function expectStatus(label, status, fn, code) {
  try {
    await fn();
  } catch (error) {
    if (error.status === status && (!code || error.payload?.code === code)) {
      console.info(`OK ${label}`);
      return error.payload;
    }
    throw error;
  }
  throw new Error(`${label} should have returned ${status}.`);
}

function mockGoogleToken(payload) {
  return `mock-google:${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')}`;
}

async function register(role, label, phone = '+356 9900 0000') {
  const response = await request('/auth/register', {
    method: 'POST',
    body: {
      email: `gate.${label}.${suffix}@malta.test`,
      password: 'Password123!',
      role,
      displayName: `Gate ${label}`,
      phone,
      location: 'Sliema',
      companyName: role === 'CONTRACTOR' ? `Gate ${label} Trades` : undefined,
      tradeCategories: role === 'CONTRACTOR' ? ['Plumbing'] : [],
      termsAccepted: true,
      privacyAccepted: true,
    },
  });

  if (!response.debugEmailVerificationToken) {
    throw new Error('Run this smoke test against a non-production API with AUTH_EMAIL_DEBUG_TOKENS=true.');
  }

  return response;
}

async function verify(session) {
  const response = await request('/auth/verify-email', {
    method: 'POST',
    body: { token: session.debugEmailVerificationToken },
  });
  if (!response.user?.emailVerifiedAt) {
    throw new Error('Email verification did not set emailVerifiedAt.');
  }
  return response;
}

async function main() {
  const unverified = await register('CONTRACTOR', 'unverified', '99123456');
  if (unverified.user.profile?.phone !== '+35699123456') {
    throw new Error(`Phone was not normalized to Malta E.164 format. Got ${unverified.user.profile?.phone}`);
  }
  console.info('OK phone normalization works');

  await expectStatus(
    'unverified user cannot browse protected jobs',
    403,
    () => request('/jobs', { token: unverified.accessToken }),
    'EMAIL_NOT_VERIFIED',
  );

  await expectStatus(
    'unverified user cannot access protected offers',
    403,
    () => request('/offers/mine', { token: unverified.accessToken }),
    'EMAIL_NOT_VERIFIED',
  );

  const resend = await request('/auth/send-email-verification', {
    method: 'POST',
    token: unverified.accessToken,
  });
  if (!resend.success) {
    throw new Error('Unverified user could not resend verification email.');
  }
  console.info('OK unverified user can resend verification');

  await verify(unverified);
  const jobs = await request('/jobs', { token: unverified.accessToken });
  if (!jobs.pagination) {
    throw new Error('Verified contractor could not access jobs.');
  }
  console.info('OK verified user can access protected jobs');

  const googleEmail = `gate.google.${suffix}@malta.test`;
  const googleSession = await request('/auth/google', {
    method: 'POST',
    body: {
      idToken: mockGoogleToken({
        googleId: `gate-google-${suffix}`,
        email: googleEmail,
        emailVerified: true,
        displayName: 'Gate Google',
        audience: 'mock',
      }),
      role: 'EMPLOYER',
      termsAccepted: true,
      privacyAccepted: true,
    },
  });
  if (!googleSession.user.emailVerifiedAt) {
    throw new Error('Verified Google user did not get emailVerifiedAt.');
  }
  console.info('OK Google verified user gets emailVerifiedAt');

  const employer = await register('EMPLOYER', 'employer');
  const contractor = await register('CONTRACTOR', 'contractor');
  await verify(employer);
  await verify(contractor);

  const job = await request('/jobs', {
    method: 'POST',
    token: employer.accessToken,
    body: {
      title: `Gate plumbing ${suffix}`,
      description: 'Smoke test job for date validation.',
      category: 'plumbing',
      subcategory: 'pipe_installation',
      location: 'Sliema',
      imageUrls: [],
    },
  });

  await expectStatus('past offer start date is rejected', 400, () =>
    request(`/jobs/${job.id}/offers`, {
      method: 'POST',
      token: contractor.accessToken,
      body: {
        estimatedPrice: 100,
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        estimatedCompletionDays: 2,
        message: 'I can help with this job.',
      },
    }),
  );

  console.info('Auth verification gate smoke test passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
