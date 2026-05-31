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
      email: `m4.${label}.${suffix}@malta.test`,
      password: 'Password123!',
      role,
      displayName: `Milestone 4 ${label}`,
      phone: '+356 9900 4444',
      location: 'Malta',
      companyName: role === 'CONTRACTOR' ? `M4 ${label} Trades` : undefined,
      tradeCategories: role === 'CONTRACTOR' ? ['Electrical'] : undefined,
    },
  });
}

async function createJob(employerSession, label) {
  return request('/jobs', {
    method: 'POST',
    token: employerSession.accessToken,
    body: {
      title: `Milestone 4 ${label} job`,
      description: 'Need a skilled contractor for a smoke test contact unlock workflow.',
      category: 'electrical',
      subcategory: 'repairs',
      location: 'Sliema, Malta',
      imageUrls: [],
    },
  });
}

async function createOffer(contractorSession, jobId, price = 120) {
  return request(`/jobs/${jobId}/offers`, {
    method: 'POST',
    token: contractorSession.accessToken,
    body: {
      estimatedPrice: price,
      estimatedCompletionDays: 2,
      message: 'Available this week for the work.',
    },
  });
}

async function main() {
  const employer = await register('EMPLOYER', 'employer');
  const contractor = await register('CONTRACTOR', 'contractor');
  const otherContractor = await register('CONTRACTOR', 'other.contractor');
  const noTokenContractor = await register('CONTRACTOR', 'no.tokens');
  const admin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@malta.test', password: 'Password123!' },
  });

  const packages = await request('/tokens/packages', { token: contractor.accessToken });
  const starter = packages.find((tokenPackage) => tokenPackage.title === 'Starter') ?? packages[0];
  if (!starter) {
    throw new Error('No active token package available for unlock smoke test.');
  }

  await request('/tokens/mock-purchase', {
    method: 'POST',
    token: contractor.accessToken,
    body: { tokenPackageId: starter.id },
  });
  const startingBalance = await request('/tokens/balance', { token: contractor.accessToken });

  const job = await createJob(employer, 'primary');
  const offer = await createOffer(contractor, job.id);

  const employerOffersBefore = await request(`/jobs/${job.id}/offers`, { token: employer.accessToken });
  const employerOfferBefore = employerOffersBefore.data.find((item) => item.id === offer.id);
  if (!employerOfferBefore || employerOfferBefore.contractor || employerOfferBefore.contractorId) {
    throw new Error('Employer offer response leaked contractor identity before unlock.');
  }
  if (employerOfferBefore.message !== 'Available this week for the work.') {
    throw new Error('Employer pre-unlock response should include offer message.');
  }
  console.info('OK identity hidden before unlock');

  const contractorOffersBefore = await request('/offers/mine?limit=100', { token: contractor.accessToken });
  const contractorOfferBefore = contractorOffersBefore.data.find((item) => item.id === offer.id);
  if (!contractorOfferBefore || contractorOfferBefore.employer) {
    throw new Error('Contractor offer response leaked employer identity before unlock.');
  }
  console.info('OK employer identity hidden before unlock');

  const requested = await request(`/offers/${offer.id}/request-contact`, {
    method: 'POST',
    token: employer.accessToken,
  });
  if (requested.status !== 'PENDING' || !requested.requestedByEmployer) {
    throw new Error('Employer request-contact did not create pending unlock.');
  }
  console.info('OK employer can request contact');

  await expectStatus('employer cannot spend tokens to unlock', 403, () =>
    request(`/offers/${offer.id}/unlock`, {
      method: 'POST',
      token: employer.accessToken,
    }),
  );

  await expectStatus('contractor cannot unlock another contractor offer', 403, () =>
    request(`/offers/${offer.id}/unlock`, {
      method: 'POST',
      token: otherContractor.accessToken,
    }),
  );

  const statusBefore = await request(`/offers/${offer.id}/unlock-status`, {
    token: contractor.accessToken,
  });
  if (statusBefore.status !== 'PENDING' || statusBefore.cost !== 1) {
    throw new Error('Unlock status endpoint did not return pending state and cost.');
  }
  console.info('OK unlock status endpoint works before unlock');

  const unlocked = await request(`/offers/${offer.id}/unlock`, {
    method: 'POST',
    token: contractor.accessToken,
  });
  if (unlocked.contact.status !== 'UNLOCKED' || unlocked.transaction.type !== 'SPEND' || unlocked.transaction.amount !== -1) {
    throw new Error('Unlock did not create contact and SPEND transaction.');
  }
  console.info('OK contractor can unlock own offer');
  console.info('OK SPEND transaction is created');

  const balanceAfterUnlock = await request('/tokens/balance', { token: contractor.accessToken });
  if (balanceAfterUnlock.balance !== startingBalance.balance - 1) {
    throw new Error('Unlock did not deduct exactly one token.');
  }
  console.info('OK one token is deducted and balance updates correctly');

  const transactions = await request('/tokens/transactions?limit=100', { token: contractor.accessToken });
  if (!transactions.data.some((transaction) => transaction.id === unlocked.transaction.id && transaction.type === 'SPEND')) {
    throw new Error('SPEND transaction was not present in transaction history.');
  }

  const statusAfter = await request(`/offers/${offer.id}/unlock-status`, {
    token: employer.accessToken,
  });
  if (statusAfter.status !== 'UNLOCKED' || !statusAfter.contactId) {
    throw new Error('Unlock status endpoint did not return unlocked state.');
  }
  console.info('OK unlock status endpoint works after unlock');

  const employerOffersAfter = await request(`/jobs/${job.id}/offers`, { token: employer.accessToken });
  const employerOfferAfter = employerOffersAfter.data.find((item) => item.id === offer.id);
  if (!employerOfferAfter?.contractor?.email || !employerOfferAfter.contractor.profile?.phone) {
    throw new Error('Employer cannot see contractor identity after unlock.');
  }

  const contractorOffersAfter = await request('/offers/mine?limit=100', { token: contractor.accessToken });
  const contractorOfferAfter = contractorOffersAfter.data.find((item) => item.id === offer.id);
  if (!contractorOfferAfter?.employer?.email || !contractorOfferAfter.employer.profile?.phone) {
    throw new Error('Contractor cannot see employer identity after unlock.');
  }
  console.info('OK identity visible after unlock');

  const employerContacts = await request('/contacts?limit=20', { token: employer.accessToken });
  if (!employerContacts.data.some((contact) => contact.id === unlocked.contact.id)) {
    throw new Error('Employer contacts did not include unlocked contact.');
  }

  const contractorContacts = await request('/contacts?limit=20', { token: contractor.accessToken });
  if (!contractorContacts.data.some((contact) => contact.id === unlocked.contact.id)) {
    throw new Error('Contractor contacts did not include unlocked contact.');
  }

  const contactDetails = await request(`/contacts/${unlocked.contact.id}`, { token: contractor.accessToken });
  if (!contactDetails.employer.email || !contactDetails.contractor.email) {
    throw new Error('Contact details did not include both identities.');
  }
  console.info('OK unlocked contacts and contact details work');

  await expectStatus('already unlocked offer cannot be unlocked again', 409, () =>
    request(`/offers/${offer.id}/unlock`, {
      method: 'POST',
      token: contractor.accessToken,
    }),
  );

  const noTokenJob = await createJob(employer, 'insufficient');
  const noTokenOffer = await createOffer(noTokenContractor, noTokenJob.id, 80);
  await expectStatus('insufficient balance prevents unlock', 400, () =>
    request(`/offers/${noTokenOffer.id}/unlock`, {
      method: 'POST',
      token: noTokenContractor.accessToken,
    }),
  );
  const noTokenBalance = await request('/tokens/balance', { token: noTokenContractor.accessToken });
  if (noTokenBalance.balance !== 0) {
    throw new Error('Insufficient unlock attempt changed balance.');
  }
  console.info('OK balance never goes negative');

  const inactiveJob = await createJob(employer, 'inactive');
  const inactiveOffer = await createOffer(otherContractor, inactiveJob.id, 95);
  await request(`/offers/${inactiveOffer.id}/withdraw`, {
    method: 'POST',
    token: otherContractor.accessToken,
  });
  await expectStatus('inactive offer cannot be unlocked', 400, () =>
    request(`/offers/${inactiveOffer.id}/unlock`, {
      method: 'POST',
      token: otherContractor.accessToken,
    }),
  );

  const adminContacts = await request('/admin/contacts?limit=100', { token: admin.accessToken });
  if (!adminContacts.data.some((contact) => contact.id === unlocked.contact.id)) {
    throw new Error('Admin contact list did not include unlock relationship.');
  }

  const adminContact = await request(`/admin/contacts/${unlocked.contact.id}`, { token: admin.accessToken });
  if (!adminContact.employer.email || !adminContact.contractor.email) {
    throw new Error('Admin contact details did not include relationship identities.');
  }
  console.info('OK admin can view all unlock relationships');

  const dbContact = await prisma.contactUnlock.findUnique({
    where: { id: unlocked.contact.id },
  });
  if (!dbContact || dbContact.status !== 'UNLOCKED' || dbContact.tokenTransactionId !== unlocked.transaction.id) {
    throw new Error('Unlock record was not stored with spend transaction.');
  }
  console.info('OK unlock record is created and transaction-linked');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
