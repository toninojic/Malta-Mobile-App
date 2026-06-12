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
  const result = await requestMaybe(path, options);

  if (!result.response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} failed with ${result.response.status}: ${JSON.stringify(result.payload)}`);
  }

  return result.payload;
}

async function requestMaybe(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.formData ? {} : { 'Content-Type': 'application/json' }),
  };

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.formData ?? (options.body ? JSON.stringify(options.body) : undefined),
  });

  const payload = await response.json().catch(() => null);
  return { response, payload };
}

async function expectStatus(label, status, fn, expectedMessage) {
  const { response, payload } = await fn();

  if (response.status !== status) {
    throw new Error(`${label} expected ${status}, got ${response.status}: ${JSON.stringify(payload)}`);
  }

  if (expectedMessage && !JSON.stringify(payload).includes(expectedMessage)) {
    throw new Error(`${label} response did not include "${expectedMessage}": ${JSON.stringify(payload)}`);
  }

  console.info(`OK ${label}`);
  return payload;
}

async function register(role, label) {
  return request('/auth/register', {
    method: 'POST',
    body: {
      email: `qa.mobile.${label}.${suffix}@malta.test`,
      password: 'Password123!',
      role,
      displayName: `QA Mobile ${label}`,
      location: 'Malta',
      companyName: role === 'CONTRACTOR' ? `QA ${label} Trades` : undefined,
      tradeCategories: role === 'CONTRACTOR' ? ['plumbing'] : undefined,
    },
  });
}

function validJob(overrides = {}) {
  return {
    title: 'Kitchen leak repair',
    description: 'Need a licensed plumber to repair a kitchen sink leak this week.',
    category: 'plumbing',
    subcategory: 'leak_repair',
    location: 'Sliema',
    imageUrls: [],
    ...overrides,
  };
}

async function uploadTinyAvatar(token) {
  const bytes = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);
  const formData = new FormData();
  formData.append('avatar', new Blob([bytes], { type: 'image/png' }), 'avatar.png');

  return request('/users/me/avatar', {
    method: 'POST',
    token,
    formData,
  });
}

async function main() {
  const employer = await register('EMPLOYER', 'employer');
  const contractor = await register('CONTRACTOR', 'contractor');

  await expectStatus('anonymous profile access is protected', 401, () => requestMaybe('/users/me'));

  const activitySummary = await request('/activity/summary', { token: contractor.accessToken });
  if (activitySummary.role !== 'CONTRACTOR' || typeof activitySummary.myOffersCount !== 'number') {
    throw new Error(`Activity summary returned invalid contractor payload: ${JSON.stringify(activitySummary)}`);
  }
  console.info('OK activity summary endpoint returns lightweight counts');

  for (let index = 0; index < 10; index += 1) {
    await request('/activity/summary', { token: contractor.accessToken });
  }
  console.info('OK activity summary tolerates controlled mobile refresh burst');

  await expectStatus('job title min validation returns field message', 400, () =>
    requestMaybe('/jobs', {
      method: 'POST',
      token: employer.accessToken,
      body: validJob({ title: 'Fix' }),
    }), 'Title must be at least 5 characters.',
  );

  await expectStatus('job description min validation returns field message', 400, () =>
    requestMaybe('/jobs', {
      method: 'POST',
      token: employer.accessToken,
      body: validJob({ description: 'Too short' }),
    }), 'Description must be at least 20 characters.',
  );

  await expectStatus('invalid category combination is rejected', 400, () =>
    requestMaybe('/jobs', {
      method: 'POST',
      token: employer.accessToken,
      body: validJob({ subcategory: 'wiring' }),
    }), 'Invalid service subcategory for selected category.',
  );

  await expectStatus('subcategory filter requires category', 400, () =>
    requestMaybe('/jobs?subcategory=leak_repair', {
      token: contractor.accessToken,
    }), 'Select a category before filtering by subcategory.',
  );

  const job = await request('/jobs', {
    method: 'POST',
    token: employer.accessToken,
    body: validJob(),
  });
  if (job.category !== 'plumbing' || job.subcategory !== 'leak_repair') {
    throw new Error(`Created job did not preserve service category keys: ${JSON.stringify(job)}`);
  }
  console.info('OK valid expanded category job can be created');

  await expectStatus('contractors still cannot create jobs', 403, () =>
    requestMaybe('/jobs', {
      method: 'POST',
      token: contractor.accessToken,
      body: validJob(),
    }),
  );

  const profile = await uploadTinyAvatar(employer.accessToken);
  if (!profile.avatarUrl?.includes('/uploads/avatars/')) {
    throw new Error(`Avatar upload did not update profile avatarUrl: ${JSON.stringify(profile)}`);
  }
  console.info('OK avatar upload stores local image and updates profile');

  await expectStatus('avatar upload validates file type', 400, () => {
    const formData = new FormData();
    formData.append('avatar', new Blob(['not an image'], { type: 'text/plain' }), 'avatar.txt');
    return requestMaybe('/users/me/avatar', {
      method: 'POST',
      token: employer.accessToken,
      formData,
    });
  }, 'Only jpg, jpeg, png, and webp images are allowed.');

  const packages = await request('/tokens/packages', { token: contractor.accessToken });
  const starter = packages.find((tokenPackage) => tokenPackage.title === 'Starter') ?? packages[0];
  if (!starter) {
    throw new Error('No token package seed data found.');
  }
  console.info('OK token package seed data exists');

  const paymentConfig = await request('/payments/config', { token: contractor.accessToken });
  if (!['MOCK', 'REVENUECAT', 'UNCONFIGURED'].includes(paymentConfig.mode)) {
    throw new Error(`Payment config returned invalid mode: ${JSON.stringify(paymentConfig)}`);
  }
  console.info(`OK payment config endpoint (${paymentConfig.mode})`);

  if (paymentConfig.mockPurchasesEnabled) {
    const balanceBefore = await request('/tokens/balance', { token: contractor.accessToken });
    const purchase = await request('/tokens/mock-purchase', {
      method: 'POST',
      token: contractor.accessToken,
      body: { tokenPackageId: starter.id },
    });
    if (purchase.balance.balance !== balanceBefore.balance + starter.tokenCount) {
      throw new Error('Mock token purchase did not add tokens to wallet balance.');
    }
    if (purchase.transaction.type !== 'PURCHASE') {
      throw new Error('Mock token purchase did not create purchase transaction.');
    }
    console.info('OK mock purchase is instant when ALLOW_MOCK_PURCHASES=true');
  } else {
    await expectStatus('mock purchase endpoint is disabled when ALLOW_MOCK_PURCHASES=false', 410, () =>
      requestMaybe('/tokens/mock-purchase', {
        method: 'POST',
        token: contractor.accessToken,
        body: { tokenPackageId: starter.id },
      }),
    );

    if (paymentConfig.mode === 'UNCONFIGURED') {
      if (paymentConfig.purchasesConfigured !== false) {
        throw new Error('Unconfigured purchase mode must report purchasesConfigured=false.');
      }
      console.info('OK purchase config reports purchases not configured when mock mode and RevenueCat are disabled');
    } else {
      console.info('OK RevenueCat purchase mode is configured');
    }
  }

  console.info('QA mobile UX smoke test passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
