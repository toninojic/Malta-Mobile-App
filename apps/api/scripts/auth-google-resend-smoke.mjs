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

async function expectStatus(label, statuses, fn) {
  const expected = Array.isArray(statuses) ? statuses : [statuses];
  try {
    await fn();
  } catch (error) {
    if (expected.some((status) => String(error.message).includes(` ${status}:`))) {
      console.info(`OK ${label}`);
      return;
    }

    throw error;
  }

  throw new Error(`${label} should have returned ${expected.join(' or ')}.`);
}

function mockGoogleToken(payload) {
  return `mock-google:${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')}`;
}

async function register(role, label, password = 'Password123!') {
  return request('/auth/register', {
    method: 'POST',
    body: {
      email: `m12.${label}.${suffix}@malta.test`,
      password,
      role,
      displayName: `Milestone 12 ${label}`,
      phone: '+356 9900 1200',
      location: role === 'CONTRACTOR' ? 'Sliema' : 'Valletta',
      companyName: role === 'CONTRACTOR' ? `M12 ${label} Trades` : undefined,
      tradeCategories: role === 'CONTRACTOR' ? ['Plumbing'] : [],
      termsAccepted: true,
      privacyAccepted: true,
    },
  });
}

function requireDebugToken(response, field, label) {
  if (!response[field]) {
    throw new Error(`${label} did not return ${field}. Run smoke against a non-production API with AUTH_EMAIL_DEBUG_TOKENS=true.`);
  }

  return response[field];
}

async function main() {
  await expectStatus('registration without legal consent blocked', 400, () =>
    request('/auth/register', {
      method: 'POST',
      body: {
        email: `m12.no-consent.${suffix}@malta.test`,
        password: 'Password123!',
        role: 'EMPLOYER',
        displayName: 'No Consent User',
      },
    }),
  );

  const verificationUser = await register('EMPLOYER', 'verify');
  const verificationToken = requireDebugToken(verificationUser, 'debugEmailVerificationToken', 'registration');
  const verified = await request('/auth/verify-email', {
    method: 'POST',
    body: { token: verificationToken },
  });
  if (!verified.success || !verified.user?.emailVerifiedAt) {
    throw new Error('Email verification did not set emailVerifiedAt.');
  }
  console.info('OK email verification succeeds');

  await expectStatus('email verification token reuse blocked', 400, () =>
    request('/auth/verify-email', {
      method: 'POST',
      body: { token: verificationToken },
    }),
  );

  const expiredUser = await register('EMPLOYER', 'expired-verify');
  const expiredToken = requireDebugToken(expiredUser, 'debugEmailVerificationToken', 'expired registration');
  await prisma.user.update({
    where: { id: expiredUser.user.id },
    data: { emailVerificationExpiresAt: new Date(Date.now() - 60_000) },
  });
  await expectStatus('expired email verification token blocked', 400, () =>
    request('/auth/verify-email', {
      method: 'POST',
      body: { token: expiredToken },
    }),
  );

  const resendUser = await register('EMPLOYER', 'resend');
  const resendResponse = await request('/auth/send-email-verification', {
    method: 'POST',
    token: resendUser.accessToken,
  });
  if (!resendResponse.success || resendResponse.alreadyVerified) {
    throw new Error('Resend verification did not return an unverified success response.');
  }
  console.info('OK resend verification endpoint works');

  const resetUser = await register('EMPLOYER', 'reset', 'OldPassword123!');
  const missingForgot = await request('/auth/forgot-password', {
    method: 'POST',
    body: { email: `missing.${suffix}@malta.test` },
  });
  if (!missingForgot.success || missingForgot.debugPasswordResetToken) {
    throw new Error('Forgot password should return a generic response for missing accounts.');
  }
  console.info('OK forgot password does not reveal missing accounts');

  const forgotResponse = await request('/auth/forgot-password', {
    method: 'POST',
    body: { email: resetUser.user.email },
  });
  const resetToken = requireDebugToken(forgotResponse, 'debugPasswordResetToken', 'forgot password');
  await request('/auth/reset-password', {
    method: 'POST',
    body: { token: resetToken, newPassword: 'NewPassword123!' },
  });
  console.info('OK password reset succeeds');

  await expectStatus('password reset token reuse blocked', 400, () =>
    request('/auth/reset-password', {
      method: 'POST',
      body: { token: resetToken, newPassword: 'AnotherPassword123!' },
    }),
  );

  await expectStatus('old refresh token invalidated after password reset', 401, () =>
    request('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: resetUser.refreshToken },
    }),
  );

  const newLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: resetUser.user.email, password: 'NewPassword123!' },
  });
  if (!newLogin.accessToken) {
    throw new Error('Login with reset password failed.');
  }
  console.info('OK login works with reset password');

  await expectStatus('invalid Google token rejected', 401, () =>
    request('/auth/google', {
      method: 'POST',
      body: { idToken: 'mock-google:this-is-not-valid-json' },
    }),
  );

  await expectStatus('new Google signup without legal consent blocked', 400, () =>
    request('/auth/google', {
      method: 'POST',
      body: {
        idToken: mockGoogleToken({
          googleId: `google-no-consent-${suffix}`,
          email: `m12.google.no-consent.${suffix}@malta.test`,
          emailVerified: true,
          audience: 'mock',
        }),
        role: 'EMPLOYER',
      },
    }),
  );

  const googleEmail = `m12.google.${suffix}@malta.test`;
  const googleToken = mockGoogleToken({
    googleId: `google-${suffix}`,
    email: googleEmail,
    emailVerified: true,
    displayName: 'Milestone 12 Google',
    picture: 'https://example.com/avatar.png',
    audience: 'mock',
  });
  const googleCreated = await request('/auth/google', {
    method: 'POST',
    body: { idToken: googleToken, role: 'EMPLOYER', termsAccepted: true, privacyAccepted: true },
  });
  if (googleCreated.user.email !== googleEmail || googleCreated.user.authProvider !== 'GOOGLE' || !googleCreated.user.emailVerifiedAt) {
    throw new Error('Google auth did not create a verified Google user.');
  }
  console.info('OK Google auth creates verified user');

  const googleFetched = await request('/auth/google', {
    method: 'POST',
    body: { idToken: googleToken },
  });
  if (googleFetched.user.id !== googleCreated.user.id) {
    throw new Error('Google auth did not fetch existing Google user.');
  }
  console.info('OK Google auth fetches existing user');

  const concurrentGoogleToken = mockGoogleToken({
    googleId: `google-concurrent-${suffix}`,
    email: `m12.google.concurrent.${suffix}@malta.test`,
    emailVerified: true,
    audience: 'mock',
  });
  const [concurrentGoogleA, concurrentGoogleB] = await Promise.all([
    request('/auth/google', {
      method: 'POST',
      body: { idToken: concurrentGoogleToken, role: 'EMPLOYER', termsAccepted: true, privacyAccepted: true },
    }),
    request('/auth/google', {
      method: 'POST',
      body: { idToken: concurrentGoogleToken, role: 'EMPLOYER', termsAccepted: true, privacyAccepted: true },
    }),
  ]);
  if (concurrentGoogleA.user.id !== concurrentGoogleB.user.id) {
    throw new Error('Concurrent Google registration created inconsistent users.');
  }
  console.info('OK concurrent Google registration resolves to one user');

  await request('/users/me', {
    method: 'DELETE',
    token: googleFetched.accessToken,
  });
  const deactivatedGoogle = await prisma.user.findUnique({ where: { id: googleCreated.user.id } });
  if (deactivatedGoogle?.status !== 'SUSPENDED' || !deactivatedGoogle.deactivatedAt) {
    throw new Error('Self-deactivation was not recorded separately from admin suspension.');
  }

  const googleLoginReactivated = await request('/auth/google', {
    method: 'POST',
    body: { idToken: googleToken },
  });
  if (googleLoginReactivated.user.id !== googleCreated.user.id || googleLoginReactivated.user.status !== 'ACTIVE') {
    throw new Error('Google login did not reactivate the self-deactivated account.');
  }
  console.info('OK Google login reactivates a self-deactivated account');

  await request('/users/me', {
    method: 'DELETE',
    token: googleLoginReactivated.accessToken,
  });
  await expectStatus('Google reactivation cannot change the original role', 400, () =>
    request('/auth/google', {
      method: 'POST',
      body: { idToken: googleToken, role: 'CONTRACTOR', termsAccepted: true, privacyAccepted: true },
    }),
  );
  const googleRegistrationReactivated = await request('/auth/google', {
    method: 'POST',
    body: { idToken: googleToken, role: 'EMPLOYER', termsAccepted: true, privacyAccepted: true },
  });
  if (googleRegistrationReactivated.user.id !== googleCreated.user.id || !googleRegistrationReactivated.accountReactivated) {
    throw new Error('Google registration did not reactivate the existing account.');
  }
  console.info('OK Google registration reactivates a self-deactivated account');

  await request('/users/me', {
    method: 'DELETE',
    token: googleRegistrationReactivated.accessToken,
  });
  await prisma.user.update({
    where: { id: googleCreated.user.id },
    data: { deactivatedAt: null },
  });
  const legacyGoogleReactivated = await request('/auth/google', {
    method: 'POST',
    body: { idToken: googleToken },
  });
  if (legacyGoogleReactivated.user.id !== googleCreated.user.id || legacyGoogleReactivated.user.status !== 'ACTIVE') {
    throw new Error('Legacy Google self-deactivation compatibility failed.');
  }
  console.info('OK legacy Google self-deactivation can be reactivated');

  const moderatedGoogleEmail = `m12.google.moderated.${suffix}@malta.test`;
  const moderatedGoogleToken = mockGoogleToken({
    googleId: `google-moderated-${suffix}`,
    email: moderatedGoogleEmail,
    emailVerified: true,
    audience: 'mock',
  });
  const moderatedGoogle = await request('/auth/google', {
    method: 'POST',
    body: { idToken: moderatedGoogleToken, role: 'CONTRACTOR', termsAccepted: true, privacyAccepted: true },
  });
  const auditAdmin =
    (await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } })) ??
    (await prisma.user.create({
      data: {
        email: `m12.audit-admin.${suffix}@malta.test`,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      select: { id: true },
    }));
  await prisma.$transaction([
    prisma.user.update({
      where: { id: moderatedGoogle.user.id },
      data: { status: 'SUSPENDED', deactivatedAt: null },
    }),
    prisma.auditLog.create({
      data: {
        adminId: auditAdmin.id,
        action: 'USER_SUSPENDED',
        entityType: 'User',
        entityId: moderatedGoogle.user.id,
      },
    }),
  ]);
  await expectStatus('admin-suspended Google user cannot reactivate', 401, () =>
    request('/auth/google', {
      method: 'POST',
      body: {
        idToken: moderatedGoogleToken,
        role: 'CONTRACTOR',
        termsAccepted: true,
        privacyAccepted: true,
      },
    }),
  );

  const linkUser = await register('CONTRACTOR', 'link-google');
  const linkToken = mockGoogleToken({
    googleId: `google-link-${suffix}`,
    email: linkUser.user.email,
    emailVerified: true,
    displayName: 'Linked Google Contractor',
    audience: 'mock',
  });
  const linked = await request('/auth/google', {
    method: 'POST',
    body: { idToken: linkToken },
  });
  if (linked.user.id !== linkUser.user.id || linked.user.authProvider !== 'BOTH' || !linked.user.emailVerifiedAt) {
    throw new Error('Google auth did not link to existing email/password user.');
  }
  console.info('OK Google auth links existing email/password user');

  const suspended = await register('EMPLOYER', 'suspended');
  await prisma.user.update({
    where: { id: suspended.user.id },
    data: { status: 'SUSPENDED' },
  });
  await expectStatus('suspended user cannot login', 401, () =>
    request('/auth/login', {
      method: 'POST',
      body: { email: suspended.user.email, password: 'Password123!' },
    }),
  );
  await expectStatus('suspended user cannot request verification email', 401, () =>
    request('/auth/send-email-verification', {
      method: 'POST',
      token: suspended.accessToken,
    }),
  );

  console.info('Milestone 12 Google/Resend auth smoke test passed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
