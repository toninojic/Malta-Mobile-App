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

async function expectForbidden(label, fn) {
  try {
    await fn();
  } catch (error) {
    if (String(error.message).includes('403')) {
      console.info(`OK ${label}`);
      return;
    }
    throw error;
  }

  throw new Error(`${label} should have been forbidden.`);
}

async function main() {
  const employerEmail = `employer.${suffix}@malta.test`;
  const contractorEmail = `contractor.${suffix}@malta.test`;
  const otherEmployerEmail = `other.employer.${suffix}@malta.test`;
  const password = 'Password123!';

  const employerSession = await request('/auth/register', {
    method: 'POST',
    body: {
      email: employerEmail,
      password,
      role: 'EMPLOYER',
      displayName: 'Smoke Employer',
      location: 'Sliema, Malta',
    },
  });
  console.info('OK registration works');

  const contractorSession = await request('/auth/register', {
    method: 'POST',
    body: {
      email: contractorEmail,
      password,
      role: 'CONTRACTOR',
      displayName: 'Smoke Contractor',
      location: 'Mosta, Malta',
      tradeCategories: ['Electrical'],
    },
  });

  const otherEmployerSession = await request('/auth/register', {
    method: 'POST',
    body: {
      email: otherEmployerEmail,
      password,
      role: 'EMPLOYER',
      displayName: 'Other Smoke Employer',
      location: 'Rabat, Malta',
    },
  });

  const login = await request('/auth/login', {
    method: 'POST',
    body: { email: employerEmail, password },
  });
  console.info('OK login works');

  const refreshed = await request('/auth/refresh', {
    method: 'POST',
    body: { refreshToken: login.refreshToken },
  });
  console.info('OK refresh token works');

  const profile = await request('/users/me/profile', {
    method: 'PATCH',
    token: refreshed.accessToken,
    body: {
      displayName: 'Smoke Employer Updated',
      phone: '+356 9900 1111',
      location: 'Valletta, Malta',
    },
  });
  if (profile.displayName !== 'Smoke Employer Updated') {
    throw new Error('Profile update did not persist.');
  }
  console.info('OK profile update works');

  const job = await request('/jobs', {
    method: 'POST',
    token: refreshed.accessToken,
    body: {
      title: 'Smoke test apartment painting',
      description: 'Paint a two bedroom apartment and repair minor wall cracks before moving in.',
      category: 'painting',
      subcategory: 'interior',
      location: 'Sliema, Malta',
      imageUrls: ['https://images.unsplash.com/photo-1562259949-e8e7689d7828'],
    },
  });
  console.info('OK employer can create job request');

  const updated = await request(`/jobs/${job.id}`, {
    method: 'PATCH',
    token: refreshed.accessToken,
    body: {
      title: 'Smoke test apartment painting updated',
      description: 'Paint a two bedroom apartment and repair minor wall cracks before moving in next month.',
      category: 'painting',
      subcategory: 'interior',
      location: 'Gzira, Malta',
      imageUrls: [],
    },
  });
  if (updated.location !== 'Gzira, Malta') {
    throw new Error('Job update did not persist.');
  }
  console.info('OK employer can edit job request');

  await request(`/jobs/${job.id}/renew`, {
    method: 'POST',
    token: refreshed.accessToken,
  });
  console.info('OK employer can renew job request');

  await expectForbidden('contractor cannot manage job requests', () =>
    request('/jobs', {
      method: 'POST',
      token: contractorSession.accessToken,
      body: {
        title: 'Forbidden contractor job',
        description: 'Contractors should not be able to create employer job requests.',
        category: 'electrical',
        subcategory: 'wiring',
        location: 'Mosta, Malta',
      },
    }),
  );

  await expectForbidden('employers can access only their own jobs', () =>
    request(`/jobs/${job.id}`, {
      token: otherEmployerSession.accessToken,
    }),
  );

  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@malta.test', password },
  });
  await request(`/jobs/${job.id}`, {
    token: adminLogin.accessToken,
  });
  console.info('OK admin can access all jobs');

  await request(`/jobs/${job.id}`, {
    method: 'DELETE',
    token: refreshed.accessToken,
  });
  console.info('OK employer can delete job request');

  await request('/auth/logout', {
    method: 'POST',
    token: refreshed.accessToken,
  });
  console.info('OK logout works');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
