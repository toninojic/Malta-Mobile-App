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

async function expectConflict(label, fn) {
  try {
    await fn();
  } catch (error) {
    if (String(error.message).includes('409')) {
      console.info(`OK ${label}`);
      return;
    }
    throw error;
  }

  throw new Error(`${label} should have returned a conflict.`);
}

function assertMaskedOffer(offer) {
  const hiddenFields = ['contractorId', 'contractor', 'email', 'phone', 'profile'];

  for (const field of hiddenFields) {
    if (Object.prototype.hasOwnProperty.call(offer, field)) {
      throw new Error(`Masked employer offer leaked ${field}.`);
    }
  }
}

async function main() {
  const password = 'Password123!';

  const employerSession = await request('/auth/register', {
    method: 'POST',
    body: {
      email: `m2.employer.${suffix}@malta.test`,
      password,
      role: 'EMPLOYER',
      displayName: 'Milestone Two Employer',
      location: 'Sliema, Malta',
    },
  });

  const otherEmployerSession = await request('/auth/register', {
    method: 'POST',
    body: {
      email: `m2.other.employer.${suffix}@malta.test`,
      password,
      role: 'EMPLOYER',
      displayName: 'Other Milestone Two Employer',
      location: 'Valletta, Malta',
    },
  });

  const contractorSession = await request('/auth/register', {
    method: 'POST',
    body: {
      email: `m2.contractor.${suffix}@malta.test`,
      password,
      role: 'CONTRACTOR',
      displayName: 'Milestone Two Contractor',
      location: 'Mosta, Malta',
      companyName: 'M2 Electrical',
      tradeCategories: ['Electrical'],
    },
  });

  const otherContractorSession = await request('/auth/register', {
    method: 'POST',
    body: {
      email: `m2.other.contractor.${suffix}@malta.test`,
      password,
      role: 'CONTRACTOR',
      displayName: 'Other Milestone Two Contractor',
      location: 'Rabat, Malta',
      tradeCategories: ['Electrical'],
    },
  });

  const job = await request('/jobs', {
    method: 'POST',
    token: employerSession.accessToken,
    body: {
      title: 'Milestone 2 electrical repair',
      description: 'Inspect a breaker board and repair two faulty sockets in a Sliema apartment.',
      category: 'electrical',
      subcategory: 'repairs',
      location: 'Sliema, Malta',
      imageUrls: [],
    },
  });

  const browse = await request('/jobs?category=electrical&location=Sliema', {
    token: contractorSession.accessToken,
  });
  if (!browse.data.some((item) => item.id === job.id)) {
    throw new Error('Contractor browse did not include active filtered job.');
  }
  console.info('OK contractor can browse and filter active jobs');

  await expectForbidden('employer cannot browse contractor job feed', () =>
    request('/jobs', { token: employerSession.accessToken }),
  );

  const offer = await request(`/jobs/${job.id}/offers`, {
    method: 'POST',
    token: contractorSession.accessToken,
    body: {
      estimatedPrice: 180,
      estimatedCompletionDays: 2,
      message: 'Can visit tomorrow morning.',
    },
  });
  console.info('OK contractor can create offer');

  await expectConflict('contractor cannot create duplicate offer for same job', () =>
    request(`/jobs/${job.id}/offers`, {
      method: 'POST',
      token: contractorSession.accessToken,
      body: {
        estimatedPrice: 190,
        estimatedCompletionDays: 3,
      },
    }),
  );

  const editedOffer = await request(`/offers/${offer.id}`, {
    method: 'PATCH',
    token: contractorSession.accessToken,
    body: {
      estimatedPrice: 165,
      estimatedCompletionDays: 1,
      message: 'Updated estimate after checking the work scope.',
    },
  });
  if (editedOffer.estimatedPrice !== '165') {
    throw new Error('Offer update did not persist.');
  }
  console.info('OK contractor can edit own offer');

  await expectForbidden('contractor cannot edit another contractor offer', () =>
    request(`/offers/${offer.id}`, {
      method: 'PATCH',
      token: otherContractorSession.accessToken,
      body: {
        estimatedPrice: 10,
      },
    }),
  );

  await expectForbidden('employer cannot create contractor offer', () =>
    request(`/jobs/${job.id}/offers`, {
      method: 'POST',
      token: employerSession.accessToken,
      body: {
        estimatedPrice: 100,
        estimatedCompletionDays: 2,
      },
    }),
  );

  const offersForEmployer = await request(`/jobs/${job.id}/offers`, {
    token: employerSession.accessToken,
  });
  if (offersForEmployer.data.length !== 1) {
    throw new Error('Employer did not receive expected offer list.');
  }
  assertMaskedOffer(offersForEmployer.data[0]);
  console.info('OK employer can view masked offers for own job');

  await expectForbidden('employer cannot view offers for another employer job', () =>
    request(`/jobs/${job.id}/offers`, { token: otherEmployerSession.accessToken }),
  );

  const selected = await request(`/offers/${offer.id}/select`, {
    method: 'POST',
    token: employerSession.accessToken,
  });
  if (!selected.selectedByEmployer || selected.status !== 'SELECTED') {
    throw new Error('Offer selection did not persist.');
  }
  console.info('OK employer can select an offer');

  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@malta.test', password },
  });
  const adminOffers = await request('/offers', {
    token: adminLogin.accessToken,
  });
  if (!adminOffers.data.some((item) => item.id === offer.id && item.contractor)) {
    throw new Error('Admin offer list did not include full offer details.');
  }
  console.info('OK admin can view all offers with full details');

  await request(`/offers/${offer.id}/withdraw`, {
    method: 'POST',
    token: contractorSession.accessToken,
  });
  console.info('OK contractor can withdraw own offer');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
