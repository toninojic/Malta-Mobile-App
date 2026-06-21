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
      email: `prelaunch.${label}.${suffix}@malta.test`,
      password: 'Password123!',
      role,
      displayName: `Prelaunch ${label}`,
      phone: '+356 9900 0000',
      location: 'Sliema',
      companyName: role === 'CONTRACTOR' ? `Prelaunch ${label} Trades` : undefined,
      tradeCategories: role === 'CONTRACTOR' ? ['Plumbing'] : [],
      termsAccepted: true,
      privacyAccepted: true,
    },
  });
}

async function createOffer(contractor, jobId, price) {
  return request(`/jobs/${jobId}/offers`, {
    method: 'POST',
    token: contractor.accessToken,
    body: {
      estimatedPrice: price,
      startDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      estimatedCompletionDays: 2,
      message: 'I can help with this job.',
    },
  });
}

async function main() {
  const employer = await register('EMPLOYER', 'employer');
  const contractorA = await register('CONTRACTOR', 'contractor-a');
  const contractorB = await register('CONTRACTOR', 'contractor-b');
  const contractorC = await register('CONTRACTOR', 'contractor-c');

  if (!employer.debugEmailVerificationToken) {
    console.warn('Skipping email token verification check because AUTH_EMAIL_DEBUG_TOKENS is disabled.');
  } else {
    const verified = await request('/auth/verify-email', {
      method: 'POST',
      body: { token: employer.debugEmailVerificationToken },
    });
    if (!verified.success || !verified.user?.emailVerifiedAt) {
      throw new Error('Email verification token did not verify the user.');
    }
    console.info('OK email verification token works');

    await expectStatus('invalid email verification token handled', 400, () =>
      request('/auth/verify-email', {
        method: 'POST',
        body: { token: 'invalid-token' },
      }),
    );

    const fallbackResponse = await fetch(`${API_URL}/auth/verify-email?token=invalid-token`);
    const fallbackText = await fallbackResponse.text();
    if (!fallbackResponse.ok || !fallbackText.includes('Verification link expired')) {
      throw new Error('Email verification web fallback did not return a clear error page.');
    }
    console.info('OK email verification web fallback works');
  }

  const job = await request('/jobs', {
    method: 'POST',
    token: employer.accessToken,
    body: {
      title: `Prelaunch plumbing ${suffix}`,
      description: 'Smoke test job for offer selection cancellation.',
      category: 'plumbing',
      subcategory: 'pipe_installation',
      location: 'Sliema',
      imageUrls: [],
    },
  });

  const offerA = await createOffer(contractorA, job.id, 100);
  const offerB = await createOffer(contractorB, job.id, 120);
  const offerC = await createOffer(contractorC, job.id, 140);

  await request(`/offers/${offerC.id}/reject`, {
    method: 'POST',
    token: employer.accessToken,
  });
  console.info('OK employer can manually reject an offer');

  await request(`/offers/${offerA.id}/select`, {
    method: 'POST',
    token: employer.accessToken,
  });
  const offersAfterSelect = await request(`/jobs/${job.id}/offers?limit=20`, { token: employer.accessToken });
  const rejectedB = offersAfterSelect.data.find((offer) => offer.id === offerB.id);
  const rejectedC = offersAfterSelect.data.find((offer) => offer.id === offerC.id);
  if (rejectedB?.status !== 'REJECTED' || rejectedB.rejectionReason !== 'AUTO_REJECTED_BY_SELECTION') {
    throw new Error('Pending offer was not auto-rejected after selection.');
  }
  if (rejectedC?.rejectionReason !== 'MANUALLY_REJECTED_BY_EMPLOYER') {
    throw new Error('Manual rejection reason was not preserved.');
  }
  console.info('OK selecting offer auto-rejects only pending offers');

  await request(`/offers/${offerA.id}/cancel-selection`, {
    method: 'POST',
    token: employer.accessToken,
  });

  const offersAfterCancel = await request(`/jobs/${job.id}/offers?limit=20`, { token: employer.accessToken });
  const restoredB = offersAfterCancel.data.find((offer) => offer.id === offerB.id);
  const stillRejectedC = offersAfterCancel.data.find((offer) => offer.id === offerC.id);
  if (restoredB?.status !== 'PENDING' || restoredB.rejectionReason) {
    throw new Error('Auto-rejected offer was not restored to pending after cancel selection.');
  }
  if (stillRejectedC?.status !== 'REJECTED' || stillRejectedC.rejectionReason !== 'MANUALLY_REJECTED_BY_EMPLOYER') {
    throw new Error('Manually rejected offer was incorrectly restored.');
  }
  console.info('OK cancel selection restores auto-rejected offers only');

  const refreshedJob = await request(`/jobs/${job.id}`, { token: employer.accessToken });
  if (refreshedJob.status !== 'ACTIVE') {
    throw new Error('Job did not become active after cancel selection.');
  }
  console.info('OK job becomes active after cancel selection');

  console.info('Final prelaunch fixes smoke test passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
