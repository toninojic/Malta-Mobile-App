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
      email: `m6.${label}.${suffix}@malta.test`,
      password: 'Password123!',
      role,
      displayName: `Milestone 6 ${label}`,
      phone: '+356 9900 6666',
      location: 'Malta',
      companyName: role === 'CONTRACTOR' ? `M6 ${label} Trades` : undefined,
      tradeCategories: role === 'CONTRACTOR' ? ['Electrical'] : undefined,
    },
  });
}

async function createJob(employerSession, label) {
  return request('/jobs', {
    method: 'POST',
    token: employerSession.accessToken,
    body: {
      title: `Milestone 6 ${label} job`,
      description: 'Smoke test job for completion, reviews, and rating summary.',
      category: 'electrical',
      subcategory: 'repairs',
      location: 'Sliema, Malta',
      imageUrls: [],
    },
  });
}

async function createOffer(contractorSession, jobId, price = 150) {
  return request(`/jobs/${jobId}/offers`, {
    method: 'POST',
    token: contractorSession.accessToken,
    body: {
      estimatedPrice: price,
      estimatedCompletionDays: 2,
      message: 'Available for completion workflow smoke test.',
    },
  });
}

async function buyStarterTokens(contractorSession) {
  const packages = await request('/tokens/packages', { token: contractorSession.accessToken });
  const starter = packages.find((tokenPackage) => tokenPackage.title === 'Starter') ?? packages[0];
  if (!starter) {
    throw new Error('No active token package available for smoke test.');
  }

  return request('/tokens/mock-purchase', {
    method: 'POST',
    token: contractorSession.accessToken,
    body: { tokenPackageId: starter.id },
  });
}

async function createUnlockedContact(employer, contractor, label) {
  const job = await createJob(employer, label);
  const offer = await createOffer(contractor, job.id);
  await buyStarterTokens(contractor);
  const unlock = await request(`/offers/${offer.id}/unlock`, {
    method: 'POST',
    token: contractor.accessToken,
  });

  return { job, offer, contact: unlock.contact };
}

function findNotification(notifications, type, metadataKey, metadataValue) {
  return notifications.data.find(
    (notification) =>
      notification.type === type &&
      notification.metadata &&
      notification.metadata[metadataKey] === metadataValue,
  );
}

async function main() {
  const employer = await register('EMPLOYER', 'employer');
  const contractor = await register('CONTRACTOR', 'contractor');
  const otherEmployer = await register('EMPLOYER', 'other.employer');
  const otherContractor = await register('CONTRACTOR', 'other.contractor');
  const admin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@malta.test', password: 'Password123!' },
  });

  const pendingJob = await createJob(employer, 'pending');
  const pendingOffer = await createOffer(contractor, pendingJob.id, 90);
  const pendingContact = await request(`/offers/${pendingOffer.id}/request-contact`, {
    method: 'POST',
    token: employer.accessToken,
  });

  await expectStatus('completion requires unlocked contact', 404, () =>
    request(`/contacts/${pendingContact.contactId}/complete`, {
      method: 'POST',
      token: contractor.accessToken,
    }),
  );

  const { job, contact } = await createUnlockedContact(employer, contractor, 'primary');

  await expectStatus('review before completion is blocked', 400, () =>
    request(`/contacts/${contact.id}/review`, {
      method: 'POST',
      token: employer.accessToken,
      body: { rating: 5, comment: 'Too early.' },
    }),
  );

  await expectStatus('employer cannot mark contractor completion', 403, () =>
    request(`/contacts/${contact.id}/complete`, {
      method: 'POST',
      token: employer.accessToken,
    }),
  );

  await expectStatus('other contractor cannot complete job', 403, () =>
    request(`/contacts/${contact.id}/complete`, {
      method: 'POST',
      token: otherContractor.accessToken,
    }),
  );

  const completion = await request(`/contacts/${contact.id}/complete`, {
    method: 'POST',
    token: contractor.accessToken,
  });
  if (completion.status !== 'PENDING_EMPLOYER_CONFIRMATION' || completion.contractorId !== contractor.user.id) {
    throw new Error('Contractor completion request did not persist.');
  }
  console.info('OK contractor can mark unlocked job completed');

  const employerNotifications = await request('/notifications?limit=100', {
    token: employer.accessToken,
  });
  if (!findNotification(employerNotifications, 'JOB_COMPLETED', 'completionId', completion.id)) {
    throw new Error('Employer completion notification was not created.');
  }
  console.info('OK employer receives completion notification');

  const statusBeforeConfirm = await request(`/contacts/${contact.id}/completion-status`, {
    token: employer.accessToken,
  });
  if (statusBeforeConfirm.status !== 'PENDING_EMPLOYER_CONFIRMATION' || statusBeforeConfirm.canReview) {
    throw new Error('Completion status before confirmation is incorrect.');
  }
  console.info('OK completion status endpoint works before confirmation');

  await expectStatus('contractor cannot confirm completion', 403, () =>
    request(`/contacts/${contact.id}/confirm-completion`, {
      method: 'POST',
      token: contractor.accessToken,
    }),
  );

  await expectStatus('other employer cannot confirm another employer job', 403, () =>
    request(`/contacts/${contact.id}/confirm-completion`, {
      method: 'POST',
      token: otherEmployer.accessToken,
    }),
  );

  const confirmed = await request(`/contacts/${contact.id}/confirm-completion`, {
    method: 'POST',
    token: employer.accessToken,
  });
  if (confirmed.status !== 'CONFIRMED' || !confirmed.employerConfirmedAt) {
    throw new Error('Employer confirmation did not persist.');
  }
  console.info('OK employer can confirm completion');

  const completedJob = await request(`/jobs/${job.id}`, {
    token: employer.accessToken,
  });
  if (completedJob.status !== 'COMPLETED') {
    throw new Error(`Job status should be COMPLETED, got ${completedJob.status}.`);
  }
  console.info('OK job status becomes COMPLETED');

  const contractorNotifications = await request('/notifications?limit=100', {
    token: contractor.accessToken,
  });
  if (!findNotification(contractorNotifications, 'JOB_COMPLETED', 'completionId', completion.id)) {
    throw new Error('Contractor confirmation notification was not created.');
  }
  console.info('OK contractor receives confirmation notification');

  const statusAfterConfirm = await request(`/contacts/${contact.id}/completion-status`, {
    token: employer.accessToken,
  });
  if (statusAfterConfirm.status !== 'CONFIRMED' || !statusAfterConfirm.canReview) {
    throw new Error('Completion status after confirmation is incorrect.');
  }
  console.info('OK review becomes available after completion');

  await expectStatus('invalid rating is rejected', 400, () =>
    request(`/contacts/${contact.id}/review`, {
      method: 'POST',
      token: employer.accessToken,
      body: { rating: 6 },
    }),
  );

  await expectStatus('contractor cannot review employer', 403, () =>
    request(`/contacts/${contact.id}/review`, {
      method: 'POST',
      token: contractor.accessToken,
      body: { rating: 5 },
    }),
  );

  const review = await request(`/contacts/${contact.id}/review`, {
    method: 'POST',
    token: employer.accessToken,
    body: { rating: 5, comment: 'Excellent work and clean finish.' },
  });
  if (review.rating !== 5 || review.status !== 'ACTIVE') {
    throw new Error('Review creation did not persist.');
  }
  console.info('OK employer can submit rating and comment');

  await expectStatus('duplicate review is blocked', 409, () =>
    request(`/contacts/${contact.id}/review`, {
      method: 'POST',
      token: employer.accessToken,
      body: { rating: 4 },
    }),
  );
  console.info('OK duplicate review prevention works');

  const notificationsAfterReview = await request('/notifications?limit=100', {
    token: contractor.accessToken,
  });
  if (!findNotification(notificationsAfterReview, 'REVIEW_RECEIVED', 'reviewId', review.id)) {
    throw new Error('Review received notification was not created.');
  }
  console.info('OK review notification is created');

  const summary = await request(`/contractors/${contractor.user.id}/rating-summary`, {
    token: employer.accessToken,
  });
  if (summary.totalReviews !== 1 || Number(summary.averageRating) !== 5) {
    throw new Error(`Rating summary should be 5.00/1, got ${summary.averageRating}/${summary.totalReviews}.`);
  }
  console.info('OK rating summary updates after review');

  await expectStatus('other contractor cannot reply to review', 403, () =>
    request(`/reviews/${review.id}/reply`, {
      method: 'PATCH',
      token: otherContractor.accessToken,
      body: { contractorReply: 'Not mine.' },
    }),
  );

  const reply = await request(`/reviews/${review.id}/reply`, {
    method: 'PATCH',
    token: contractor.accessToken,
    body: { contractorReply: 'Thank you for the review.' },
  });
  if (reply.contractorReply !== 'Thank you for the review.') {
    throw new Error('Contractor reply did not persist.');
  }
  console.info('OK contractor can reply once');

  await expectStatus('duplicate contractor reply is blocked', 409, () =>
    request(`/reviews/${review.id}/reply`, {
      method: 'PATCH',
      token: contractor.accessToken,
      body: { contractorReply: 'Second reply.' },
    }),
  );

  const employerNotificationsAfterReply = await request('/notifications?limit=100', {
    token: employer.accessToken,
  });
  if (!findNotification(employerNotificationsAfterReply, 'REVIEW_REPLIED', 'reviewId', review.id)) {
    throw new Error('Review reply notification was not created.');
  }
  console.info('OK review reply notification is created');

  const adminReviews = await request('/admin/reviews?limit=100', {
    token: admin.accessToken,
  });
  if (!adminReviews.data.some((item) => item.id === review.id)) {
    throw new Error('Admin review list did not include review.');
  }

  const adminReview = await request(`/admin/reviews/${review.id}`, {
    token: admin.accessToken,
  });
  if (adminReview.id !== review.id || !adminReview.employer || !adminReview.contractor) {
    throw new Error('Admin review details did not include full review data.');
  }
  console.info('OK admin can view reviews');

  const removed = await request(`/admin/reviews/${review.id}/remove`, {
    method: 'PATCH',
    token: admin.accessToken,
  });
  if (removed.status !== 'REMOVED' || !removed.removedAt) {
    throw new Error('Admin review removal did not persist.');
  }
  console.info('OK admin can remove review');

  await expectStatus('already removed review cannot be removed again', 409, () =>
    request(`/admin/reviews/${review.id}/remove`, {
      method: 'PATCH',
      token: admin.accessToken,
    }),
  );

  const summaryAfterRemoval = await request(`/contractors/${contractor.user.id}/rating-summary`, {
    token: employer.accessToken,
  });
  if (summaryAfterRemoval.totalReviews !== 0 || Number(summaryAfterRemoval.averageRating) !== 0) {
    throw new Error(
      `Removed review should not count, got ${summaryAfterRemoval.averageRating}/${summaryAfterRemoval.totalReviews}.`,
    );
  }
  console.info('OK removed reviews do not count in rating summary');

  const notificationsAfterRemoval = await request('/notifications?limit=100', {
    token: contractor.accessToken,
  });
  if (!findNotification(notificationsAfterRemoval, 'REVIEW_REMOVED', 'reviewId', review.id)) {
    throw new Error('Review removed notification was not created.');
  }
  console.info('OK review removal notification is created');

  const dbCompletion = await prisma.jobCompletion.findUnique({
    where: { contactUnlockId: contact.id },
  });
  if (!dbCompletion || dbCompletion.status !== 'CONFIRMED') {
    throw new Error('Completion record was not stored correctly.');
  }
  console.info('OK completion record is stored');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
