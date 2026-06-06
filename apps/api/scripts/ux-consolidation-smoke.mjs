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
  const headers = {
    Accept: 'application/json',
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
  };
  if (!options.formData) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.formData ?? (options.body ? JSON.stringify(options.body) : undefined),
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
      email: `ux.${label}.${suffix}@malta.test`,
      password: 'Password123!',
      role,
      displayName: `UX ${label}`,
      phone: '+356 9900 7777',
      location: 'Malta',
      companyName: role === 'CONTRACTOR' ? `UX ${label} Trades` : undefined,
      tradeCategories: role === 'CONTRACTOR' ? ['Electrical'] : undefined,
    },
  });
}

async function login(email, password = 'Password123!') {
  return request('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

async function createJob(employer) {
  return request('/jobs', {
    method: 'POST',
    token: employer.accessToken,
    body: {
      title: `UX plumber search ${suffix}`,
      description: 'Need a plumber and electrician friendly smoke test job for search and offer workflows.',
      category: 'plumbing',
      subcategory: 'bathroom_repairs',
      location: 'Sliema, Malta',
      imageUrls: [],
    },
  });
}

async function createOffer(contractor, jobId) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);

  return request(`/jobs/${jobId}/offers`, {
    method: 'POST',
    token: contractor.accessToken,
    body: {
      estimatedPrice: 180,
      startDate: startDate.toISOString(),
      estimatedCompletionDays: 3,
      message: 'Can start tomorrow and finish cleanly.',
    },
  });
}

async function buyTokens(contractor) {
  const packages = await request('/tokens/packages', { token: contractor.accessToken });
  const starter = packages.find((item) => item.title === 'Starter') ?? packages[0];
  assert(starter, 'Token package seed data is required.');

  return request('/tokens/mock-purchase', {
    method: 'POST',
    token: contractor.accessToken,
    body: { tokenPackageId: starter.id },
  });
}

async function uploadImage(path, token, fieldName) {
  const formData = new FormData();
  formData.append(fieldName, new Blob(['fake-image'], { type: 'image/png' }), 'proof.png');
  return request(path, {
    method: 'POST',
    token,
    formData,
  });
}

async function main() {
  const employer = await register('EMPLOYER', 'employer');
  const contractor = await register('CONTRACTOR', 'contractor');
  const admin = await login('admin@malta.test');
  const job = await createJob(employer);

  await expectStatus('startDate is required for offer creation', 400, () =>
    request(`/jobs/${job.id}/offers`, {
      method: 'POST',
      token: contractor.accessToken,
      body: {
        estimatedPrice: 120,
        estimatedCompletionDays: 2,
      },
    }),
  );

  const search = await request(`/jobs?search=${encodeURIComponent(`plumber search ${suffix}`)}&location=Sliema`, {
    token: contractor.accessToken,
  });
  assert(search.data.some((item) => item.id === job.id), 'Job search should find title matches.');

  const offer = await createOffer(contractor, job.id);
  await request(`/offers/${offer.id}/select`, {
    method: 'POST',
    token: employer.accessToken,
  });

  const selectedDetails = await request(`/offers/${offer.id}/work-details`, {
    token: contractor.accessToken,
  });
  assert(selectedDetails.offer.status === 'SELECTED', 'Selected offer should return selected status in work-details.');
  assert(selectedDetails.availableActions.includes('UNLOCK_CONTACT'), 'Selected locked offer should allow UNLOCK_CONTACT.');

  const portfolio = await uploadImage('/users/me/portfolio-images', contractor.accessToken, 'images');
  assert(portfolio.length === 1, 'Portfolio upload should return stored image.');

  const verification = await uploadImage('/users/me/contractor-verification', contractor.accessToken, 'document');
  assert(verification.status === 'PENDING_REVIEW', 'Verification upload should be pending review.');
  assert(!verification.documentUrl, 'Contractor verification response must not expose document URL.');

  const adminQueue = await request('/admin/contractor-verifications', { token: admin.accessToken });
  const adminVerification = adminQueue.data.find((item) => item.contractorId === contractor.user.id);
  assert(adminVerification?.documentUrl, 'Admin verification response should expose document URL.');

  const documentFileName = adminVerification.documentUrl.split('/').pop();
  await expectStatus('verification document is admin-only', 403, () =>
    request(`/uploads/verification-documents/${documentFileName}`, { token: employer.accessToken }),
  );

  await request(`/admin/contractor-verifications/${adminVerification.id}/approve`, {
    method: 'POST',
    token: admin.accessToken,
  });
  const approved = await request('/users/me/contractor-verification', { token: contractor.accessToken });
  assert(approved.status === 'VERIFIED', 'Approved contractor should see VERIFIED status.');

  await buyTokens(contractor);
  const unlock = await request(`/offers/${offer.id}/unlock`, {
    method: 'POST',
    token: contractor.accessToken,
  });
  await request(`/contacts/${unlock.contact.id}/complete`, {
    method: 'POST',
    token: contractor.accessToken,
  });
  await request(`/contacts/${unlock.contact.id}/confirm-completion`, {
    method: 'POST',
    token: employer.accessToken,
  });

  const review = await request(`/contacts/${unlock.contact.id}/review`, {
    method: 'POST',
    token: employer.accessToken,
    body: {
      rating: 5,
      comment: 'Great work.',
    },
  });
  await request(`/reviews/${review.id}/reply`, {
    method: 'PATCH',
    token: contractor.accessToken,
    body: {
      contractorReply: 'Thank you.',
    },
  });

  const completedDetails = await request(`/offers/${offer.id}/work-details`, {
    token: contractor.accessToken,
  });
  assert(completedDetails.offer.status === 'COMPLETED', 'Completed offer should return completed status.');
  assert(!completedDetails.availableActions.includes('EDIT_OFFER'), 'Completed offer should hide EDIT_OFFER.');
  assert(!completedDetails.availableActions.includes('WITHDRAW_OFFER'), 'Completed offer should hide WITHDRAW_OFFER.');
  assert(!completedDetails.availableActions.includes('UNLOCK_CONTACT'), 'Completed offer should hide UNLOCK_CONTACT.');

  const contractorNotifications = await request('/notifications', { token: contractor.accessToken });
  assert(
    contractorNotifications.data.some((item) => item.type === 'REVIEW_RECEIVED' && item.metadata?.reviewId === review.id),
    'Contractor should receive REVIEW_RECEIVED notification with reviewId metadata.',
  );
  const employerNotifications = await request('/notifications', { token: employer.accessToken });
  assert(
    employerNotifications.data.some((item) => item.type === 'REVIEW_REPLIED' && item.metadata?.reviewId === review.id),
    'Employer should receive REVIEW_REPLIED notification with reviewId metadata.',
  );

  console.info('UX consolidation smoke test passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
