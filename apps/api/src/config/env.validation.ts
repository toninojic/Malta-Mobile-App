import { ConfigService } from '@nestjs/config';

const PLACEHOLDER_VALUES = new Set([
  '',
  'change-me-access-secret',
  'change-me-refresh-secret',
  'replace-with-a-long-random-access-secret',
  'replace-with-a-long-random-refresh-secret',
]);

export function validateRuntimeEnvironment(config: ConfigService) {
  const nodeEnv = config.get<string>('NODE_ENV') ?? 'development';

  if (nodeEnv !== 'production') {
    return;
  }

  const missing = requiredValues(config, [
    'DATABASE_URL',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'API_PORT',
    'APP_BASE_URL',
    'APP_PUBLIC_URL',
    'MOBILE_DEEP_LINK_SCHEME',
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL',
    'STORAGE_DRIVER',
    'LOG_LEVEL',
  ]);
  const storageDriver = config.get<string>('STORAGE_DRIVER')?.trim().toLowerCase();

  if (storageDriver !== 's3') {
    missing.push('STORAGE_DRIVER=s3');
  }

  if (storageDriver === 's3') {
    missing.push(
      ...requiredValues(config, [
        'AWS_REGION',
        'AWS_S3_BUCKET',
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
      ]),
    );
  }

  if (!parseBooleanEnv(config.get<string>('ALLOW_MOCK_PURCHASES'))) {
    missing.push(...requiredValues(config, ['REVENUECAT_WEBHOOK_SECRET', 'REVENUECAT_API_KEY']));
  }

  const googleClientIds = [
    config.get<string>('GOOGLE_ANDROID_CLIENT_ID'),
    config.get<string>('GOOGLE_IOS_CLIENT_ID'),
    config.get<string>('GOOGLE_WEB_CLIENT_ID'),
    config.get<string>('GOOGLE_ALLOWED_CLIENT_IDS'),
  ].filter((value) => value?.trim());
  if (!googleClientIds.length) {
    missing.push('GOOGLE_ANDROID_CLIENT_ID or GOOGLE_WEB_CLIENT_ID');
  }

  if (missing.length) {
    throw new Error(`Missing or invalid production environment variables: ${Array.from(new Set(missing)).join(', ')}`);
  }

  assertSecretStrength('JWT_ACCESS_SECRET', config.get<string>('JWT_ACCESS_SECRET'));
  assertSecretStrength('JWT_REFRESH_SECRET', config.get<string>('JWT_REFRESH_SECRET'));
}

function requiredValues(config: ConfigService, keys: string[]) {
  return keys.filter((key) => {
    const value = config.get<string>(key)?.trim() ?? '';
    return PLACEHOLDER_VALUES.has(value);
  });
}

function assertSecretStrength(key: string, value: string | undefined) {
  if (!value || value.length < 32) {
    throw new Error(`${key} must be at least 32 characters in production.`);
  }
}

function parseBooleanEnv(value: string | undefined) {
  return ['true', '1', 'yes', 'on'].includes(String(value ?? '').trim().replace(/^['"]|['"]$/g, '').toLowerCase());
}
