import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apiUrl = normalizeApiUrl(process.argv[2] ?? readApiUrlFromEnvFile() ?? process.env.EXPO_PUBLIC_API_URL);

if (!apiUrl) {
  console.error('No API URL configured. Run: npm run api-url:set -- https://your-api.example.com/api/v1');
  process.exit(1);
}

assertPublicHttpsApiUrl(apiUrl);

const healthUrl = `${apiUrl}/health`;
let response;

try {
  response = await fetch(healthUrl, {
    headers: {
      Accept: 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
  });
} catch (error) {
  console.error(`API health check failed for ${healthUrl}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const contentType = response.headers.get('content-type') ?? '';
const responseText = await response.text();
const payload = contentType.includes('application/json') ? parseJson(responseText) : null;

if (!response.ok || !isUsableHealthPayload(payload)) {
  console.error(`API health check failed for ${healthUrl} with status ${response.status}`);
  console.error(payload ? JSON.stringify(payload, null, 2) : responseText.slice(0, 500));
  process.exit(1);
}

if (payload?.status === 'degraded') {
  console.warn(`API is reachable but health is degraded: ${healthUrl}`);
  console.warn(JSON.stringify(payload, null, 2));
} else {
  console.info(`API is reachable: ${healthUrl}`);
}

function readApiUrlFromEnvFile() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    return null;
  }

  const match = readFileSync(envPath, 'utf8').match(/^EXPO_PUBLIC_API_URL=(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

function normalizeApiUrl(value) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/\/+$/, '');
  const withoutDuplicateApiVersion = normalized.replace(/(\/api\/v1)+$/, '/api/v1');
  return withoutDuplicateApiVersion.endsWith('/api/v1')
    ? withoutDuplicateApiVersion
    : `${withoutDuplicateApiVersion}/api/v1`;
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isUsableHealthPayload(payload) {
  if (!payload) {
    return false;
  }

  if (payload.status === 'ok') {
    return true;
  }

  return payload.status === 'degraded' && payload.database === 'ok';
}

function assertPublicHttpsApiUrl(apiUrl) {
  const parsed = new URL(apiUrl);

  if (parsed.protocol !== 'https:' || isPrivateHostname(parsed.hostname)) {
    console.error('Invalid API URL for device testing. Use a public HTTPS URL such as ngrok.');
    process.exit(1);
  }
}

function isPrivateHostname(hostname) {
  const host = hostname.toLowerCase();

  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local')
  ) {
    return true;
  }

  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) {
    return true;
  }

  const private172Match = host.match(/^172\.(\d{1,2})\./);
  return private172Match ? Number(private172Match[1]) >= 16 && Number(private172Match[1]) <= 31 : false;
}
