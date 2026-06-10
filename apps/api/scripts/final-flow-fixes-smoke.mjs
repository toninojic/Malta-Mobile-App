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
    if (String(error.message).includes(String(status))) {
      console.info(`OK ${label}`);
      return;
    }

    throw error;
  }

  throw new Error(`${label} should have returned ${status}.`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function register(role, label) {
  return request('/auth/register', {
    method: 'POST',
    body: {
      email: `final.${label}.${suffix}@malta.test`,
      password: 'Password123!',
      role,
      displayName: `Final ${label}`,
      phone: '+356 9900 5555',
      location: 'Sliema',
      companyName: role === 'CONTRACTOR' ? `Final ${label} Trades` : undefined,
      tradeCategories: role === 'CONTRACTOR' ? ['Electrical'] : undefined,
    },
  });
}

async function createJob(employer, label) {
  return request('/jobs', {
    method: 'POST',
    token: employer.accessToken,
    body: {
      title: `Final flow ${label} ${suffix}`,
      description: 'Final flow smoke job for offer selection, cancellation, reviews, and profile access.',
      category: 'electrical',
      subcategory: 'lighting',
      location: 'Sliema, Malta',
      imageUrls: [],
    },
  });
}

async function createOffer(contractor, jobId, price = 150) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);

  return request(`/jobs/${jobId}/offers`, {
    method: 'POST',
    token: contractor.accessToken,
    body: {
      estimatedPrice: price,
      startDate: startDate.toISOString(),
      estimatedCompletionDays: 2,
      message: 'Available for final flow smoke test.',
    },
  });
}

async function buyStarterTokens(contractor) {
  const config = await request('/payments/config', { token: contractor.accessToken });
  assert(config.allowMockPurchases === true || config.mockPurchasesEnabled === true || config.mode === 'MOCK', 'ALLOW_MOCK_PURCHASES must be true for this smoke test.');
  assert(config.stripeConfigured === false || config.mode === 'MOCK', 'Stripe must not be required in mock mode.');

  const packages = await request('/tokens/packages', { token: contractor.accessToken });
  const starter = packages.find((item) => item.title === 'Starter') ?? packages[0];
  assert(starter, 'Token package seed data is required.');

  const before = await request('/tokens/balance', { token: contractor.accessToken });
  const purchase = await request('/tokens/mock-purchase', {
    method: 'POST',
    token: contractor.accessToken,
    body: { tokenPackageId: starter.id },
  });

  assert(purchase.transaction.type === 'PURCHASE', 'Mock purchase must create a PURCHASE transaction.');
  assert(purchase.balance.balance === before.balance + starter.tokenCount, 'Mock purchase must update wallet balance immediately.');
  return purchase;
}

async function main() {
  const employer = await register('EMPLOYER', 'employer');
  const selectedContractor = await register('CONTRACTOR', 'selected');
  const rejectedContractor = await register('CONTRACTOR', 'auto.rejected');
  const manualRejectContractor = await register('CONTRACTOR', 'manual.rejected');
  const cancelContractor = await register('CONTRACTOR', 'cancelled');
  const browseContractor = await register('CONTRACTOR', 'browser');

  const job = await createJob(employer, 'selection');
  const selectedOffer = await createOffer(selectedContractor, job.id, 200);
  const autoRejectedOffer = await createOffer(rejectedContractor, job.id, 180);

  const beforeUnlockProfile = await request(`/contractors/${selectedContractor.user.id}/profile`, {
    token: employer.accessToken,
  });
  assert(!beforeUnlockProfile.email, 'Employer must not see contractor email before unlock.');
  assert(!beforeUnlockProfile.profile?.phone, 'Employer must not see contractor phone before unlock.');

  const selected = await request(`/offers/${selectedOffer.id}/select`, {
    method: 'POST',
    token: employer.accessToken,
  });
  assert(selected.status === 'SELECTED', 'Selected offer must become SELECTED.');

  const selectedJob = await request(`/jobs/${job.id}`, { token: employer.accessToken });
  assert(selectedJob.status === 'IN_PROGRESS', 'Job must become IN_PROGRESS after offer selection.');

  const browseAfterSelection = await request(`/jobs?search=${encodeURIComponent(job.title)}`, {
    token: browseContractor.accessToken,
  });
  assert(!browseAfterSelection.data.some((item) => item.id === job.id), 'Selected job must disappear from public All Jobs.');

  const autoRejectedDetails = await request(`/offers/${autoRejectedOffer.id}/work-details`, {
    token: rejectedContractor.accessToken,
  });
  assert(autoRejectedDetails.offer.status === 'REJECTED', 'Other pending offers must become REJECTED.');
  assert(!autoRejectedDetails.availableActions.includes('UNLOCK_CONTACT'), 'Rejected offers must not allow unlock action.');
  await expectStatus('rejected offers cannot unlock', 400, () =>
    request(`/offers/${autoRejectedOffer.id}/unlock`, {
      method: 'POST',
      token: rejectedContractor.accessToken,
    }),
  );

  await buyStarterTokens(selectedContractor);
  const unlock = await request(`/offers/${selectedOffer.id}/unlock`, {
    method: 'POST',
    token: selectedContractor.accessToken,
  });
  assert(unlock.contact.status === 'UNLOCKED', 'Selected contractor must be able to unlock contact.');

  const afterUnlockProfile = await request(`/contractors/${selectedContractor.user.id}/profile`, {
    token: employer.accessToken,
  });
  assert(afterUnlockProfile.email === selectedContractor.user.email, 'Employer must see contractor email after unlock.');
  assert(afterUnlockProfile.profile?.phone, 'Employer must see contractor phone after unlock.');

  const rejectJob = await createJob(employer, 'manual-reject');
  const manualOffer = await createOffer(manualRejectContractor, rejectJob.id, 120);
  const rejected = await request(`/offers/${manualOffer.id}/reject`, {
    method: 'POST',
    token: employer.accessToken,
  });
  assert(rejected.status === 'REJECTED', 'Employer must be able to manually reject a pending offer.');

  const rejectedMine = await request('/offers/mine?limit=100', { token: manualRejectContractor.accessToken });
  assert(rejectedMine.data.some((item) => item.id === manualOffer.id && item.status === 'REJECTED'), 'Contractor must see manually rejected status.');
  await expectStatus('manually rejected offer cannot unlock', 400, () =>
    request(`/offers/${manualOffer.id}/unlock`, {
      method: 'POST',
      token: manualRejectContractor.accessToken,
    }),
  );

  const cancelJob = await createJob(employer, 'cancel-selection');
  const cancelOffer = await createOffer(cancelContractor, cancelJob.id, 140);
  await request(`/offers/${cancelOffer.id}/select`, {
    method: 'POST',
    token: employer.accessToken,
  });
  const cancelled = await request(`/offers/${cancelOffer.id}/cancel-selection`, {
    method: 'POST',
    token: employer.accessToken,
  });
  assert(cancelled.status === 'REJECTED', 'Cancelled selection must reject the selected offer.');

  const activeAgain = await request(`/jobs/${cancelJob.id}`, { token: employer.accessToken });
  assert(activeAgain.status === 'ACTIVE', 'Job must become ACTIVE again after cancel selection.');

  const browseAfterCancel = await request(`/jobs?search=${encodeURIComponent(cancelJob.title)}`, {
    token: browseContractor.accessToken,
  });
  assert(browseAfterCancel.data.some((item) => item.id === cancelJob.id), 'Cancelled-selection job must appear in public All Jobs again.');
  await expectStatus('cancelled selected offer cannot unlock', 400, () =>
    request(`/offers/${cancelOffer.id}/unlock`, {
      method: 'POST',
      token: cancelContractor.accessToken,
    }),
  );

  await request(`/contacts/${unlock.contact.id}/complete`, {
    method: 'POST',
    token: selectedContractor.accessToken,
  });
  await request(`/contacts/${unlock.contact.id}/confirm-completion`, {
    method: 'POST',
    token: employer.accessToken,
  });

  const beforeReviewSummary = await request('/activity/summary', { token: employer.accessToken });
  assert(beforeReviewSummary.reviewsToLeaveCount === 1, 'Employer review badge should count completed jobs waiting review.');

  await request(`/contacts/${unlock.contact.id}/review`, {
    method: 'POST',
    token: employer.accessToken,
    body: {
      rating: 5,
      comment: 'Excellent final flow smoke result.',
    },
  });

  const afterReviewSummary = await request('/activity/summary', { token: employer.accessToken });
  assert(afterReviewSummary.reviewsToLeaveCount === 0, 'Employer review badge should clear after review is submitted.');

  console.info('Final flow fixes smoke test passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
