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
const missingUuid = '00000000-0000-0000-0000-000000000000';

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

async function register(role, label) {
  return request('/auth/register', {
    method: 'POST',
    body: {
      email: `report-system.${label}.${suffix}@malta.test`,
      password: 'Password123!',
      role,
      displayName: `Report System ${label}`,
      phone: '+356 9900 1100',
      location: role === 'CONTRACTOR' ? 'Sliema' : 'Valletta',
      companyName: role === 'CONTRACTOR' ? `Report ${label} Trades` : undefined,
      tradeCategories: role === 'CONTRACTOR' ? ['Plumbing'] : [],
    },
  });
}

async function createJob(employer, label) {
  return request('/jobs', {
    method: 'POST',
    token: employer.accessToken,
    body: {
      title: `Report system ${label} plumbing job`,
      description: 'Smoke test job for report moderation.',
      category: 'plumbing',
      subcategory: 'pipe_installation',
      location: 'Sliema',
      imageUrls: [],
    },
  });
}

async function main() {
  const admin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@malta.test', password: 'Password123!' },
  });
  const employer = await register('EMPLOYER', 'employer');
  const contractor = await register('CONTRACTOR', 'contractor');
  const secondEmployer = await register('EMPLOYER', 'second-employer');
  const suspendedContractor = await register('CONTRACTOR', 'suspended-contractor');

  const job = await createJob(employer, 'primary');
  const secondJob = await createJob(secondEmployer, 'secondary');

  const userReport = await request('/reports', {
    method: 'POST',
    token: employer.accessToken,
    body: {
      targetType: 'USER',
      targetId: contractor.user.id,
      reason: 'FAKE_PROFILE',
      description: 'Profile details look suspicious.',
    },
  });
  if (userReport.targetType !== 'USER' || userReport.status !== 'PENDING') {
    throw new Error('Employer user report was not created correctly.');
  }
  console.info('OK employer can report contractor user');

  const jobReport = await request('/reports', {
    method: 'POST',
    token: contractor.accessToken,
    body: {
      targetType: 'JOB',
      targetId: job.id,
      reason: 'SPAM',
      description: 'Job looks duplicated.',
    },
  });
  if (jobReport.targetType !== 'JOB') {
    throw new Error('Contractor job report was not created correctly.');
  }
  console.info('OK contractor can report job');

  await expectStatus('user cannot report themselves', 400, () =>
    request('/reports', {
      method: 'POST',
      token: employer.accessToken,
      body: { targetType: 'USER', targetId: employer.user.id, reason: 'SPAM' },
    }),
  );

  await expectStatus('user cannot report missing target', 404, () =>
    request('/reports', {
      method: 'POST',
      token: employer.accessToken,
      body: { targetType: 'JOB', targetId: missingUuid, reason: 'SPAM' },
    }),
  );

  await expectStatus('duplicate pending report is blocked', 409, () =>
    request('/reports', {
      method: 'POST',
      token: contractor.accessToken,
      body: { targetType: 'JOB', targetId: job.id, reason: 'SPAM' },
    }),
  );

  await expectStatus('OTHER requires description', 400, () =>
    request('/reports', {
      method: 'POST',
      token: contractor.accessToken,
      body: { targetType: 'JOB', targetId: secondJob.id, reason: 'OTHER' },
    }),
  );

  const mine = await request('/reports/mine?limit=100', { token: contractor.accessToken });
  if (!mine.data.some((report) => report.id === jobReport.id)) {
    throw new Error('Own report list does not include contractor report.');
  }
  console.info('OK user can list own reports');

  await expectStatus('user cannot view another user report', 403, () =>
    request(`/reports/${userReport.id}`, { token: contractor.accessToken }),
  );

  const adminReports = await request('/admin/reports?limit=100', { token: admin.accessToken });
  if (!adminReports.data.some((report) => report.id === userReport.id) || !adminReports.data.some((report) => report.id === jobReport.id)) {
    throw new Error('Admin report list is missing created reports.');
  }
  console.info('OK admin can list all reports');

  await expectStatus('non-admin cannot access admin reports', 403, () =>
    request('/admin/reports', { token: contractor.accessToken }),
  );

  const updated = await request(`/admin/reports/${userReport.id}/status`, {
    method: 'PATCH',
    token: admin.accessToken,
    body: { status: 'UNDER_REVIEW', adminNote: 'Review started.' },
  });
  if (updated.status !== 'UNDER_REVIEW' || updated.reviewedByAdminId !== admin.user.id) {
    throw new Error('Admin report status update failed.');
  }
  console.info('OK admin can update report status');

  const auditLogs = await request('/admin/audit-logs?action=REPORT_MARKED_UNDER_REVIEW&limit=100', { token: admin.accessToken });
  if (!auditLogs.data.some((log) => log.entityId === userReport.id)) {
    throw new Error('Report status audit log missing.');
  }
  console.info('OK audit log created');

  const employerNotifications = await request('/notifications?limit=100', { token: employer.accessToken });
  if (!employerNotifications.data.some((notification) => notification.type === 'REPORT_STATUS_UPDATED')) {
    throw new Error('Reporter notification for status update missing.');
  }
  console.info('OK reporter notification created');

  const adminNotifications = await request('/notifications?limit=100', { token: admin.accessToken });
  if (!adminNotifications.data.some((notification) => notification.type === 'NEW_REPORT')) {
    throw new Error('Admin new report notification missing.');
  }
  console.info('OK admin notification created');

  const suspendReport = await request('/reports', {
    method: 'POST',
    token: employer.accessToken,
    body: {
      targetType: 'USER',
      targetId: suspendedContractor.user.id,
      reason: 'SCAM_OR_FRAUD',
      description: 'Suspension smoke test.',
    },
  });
  await request(`/admin/reports/${suspendReport.id}/actions/suspend-user`, {
    method: 'POST',
    token: admin.accessToken,
  });
  await expectStatus('suspended user cannot create report', [401, 403], () =>
    request('/reports', {
      method: 'POST',
      token: suspendedContractor.accessToken,
      body: { targetType: 'JOB', targetId: job.id, reason: 'SPAM' },
    }),
  );

  console.info('Report system smoke test passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
