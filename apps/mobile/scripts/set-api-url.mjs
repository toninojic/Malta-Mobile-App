import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const input = process.argv[2];

if (!input) {
  console.error('Usage: npm run api-url:set -- https://your-public-api.example.com/api/v1');
  process.exit(1);
}

const apiUrl = normalizeApiUrl(input);
assertPublicHttpsApiUrl(apiUrl);
const envPath = resolve(process.cwd(), '.env');
const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
const nextLine = `EXPO_PUBLIC_API_URL=${apiUrl}`;
const lines = existing
  .split(/\r?\n/)
  .filter((line) => line.trim() && !line.startsWith('EXPO_PUBLIC_API_URL='));

lines.push(nextLine);
writeFileSync(envPath, `${lines.join('\n')}\n`);
syncAppJson(apiUrl);
syncEasJson(apiUrl);

console.info(`Configured ${nextLine}`);
console.info('Updated .env, app.json, and eas.json.');

function normalizeApiUrl(value) {
  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    console.error('API URL must be a valid http or https URL.');
    process.exit(1);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    console.error('API URL must start with http:// or https://.');
    process.exit(1);
  }

  const normalized = parsed.toString().replace(/\/+$/, '');
  const withoutDuplicateApiVersion = normalized.replace(/(\/api\/v1)+$/, '/api/v1');
  return withoutDuplicateApiVersion.endsWith('/api/v1')
    ? withoutDuplicateApiVersion
    : `${withoutDuplicateApiVersion}/api/v1`;
}

function syncAppJson(apiUrl) {
  const appJsonPath = resolve(process.cwd(), 'app.json');
  if (!existsSync(appJsonPath)) {
    return;
  }

  const appJson = JSON.parse(readFileSync(appJsonPath, 'utf8'));
  appJson.expo = appJson.expo ?? {};
  appJson.expo.extra = appJson.expo.extra ?? {};
  appJson.expo.extra.apiUrl = apiUrl;
  appJson.expo.extra.apiDebug = false;
  writeFileSync(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`);
}

function syncEasJson(apiUrl) {
  const easJsonPath = resolve(process.cwd(), 'eas.json');
  if (!existsSync(easJsonPath)) {
    return;
  }

  const easJson = JSON.parse(readFileSync(easJsonPath, 'utf8'));
  easJson.build = easJson.build ?? {};

  for (const profile of ['development', 'preview']) {
    easJson.build[profile] = easJson.build[profile] ?? {};
    easJson.build[profile].env = easJson.build[profile].env ?? {};
    easJson.build[profile].env.EXPO_PUBLIC_API_URL = apiUrl;
    easJson.build[profile].env.EXPO_PUBLIC_API_LOGGING = 'true';
  }

  writeFileSync(easJsonPath, `${JSON.stringify(easJson, null, 2)}\n`);
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
