const { existsSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

const baseConfig = require('./app.json').expo;
const googleServicesPath = resolve(__dirname, 'google-services.json');

function parseBooleanEnv(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  return ['true', '1', 'yes', 'on'].includes(String(value).trim().replace(/^['"]|['"]$/g, '').toLowerCase());
}

function normalizeApiUrl(value) {
  const trimmed = String(value).trim().replace(/\/+$/, '');
  const withoutDuplicateApiVersion = trimmed.replace(/(\/api\/v1)+$/, '/api/v1');
  return withoutDuplicateApiVersion.endsWith('/api/v1')
    ? withoutDuplicateApiVersion
    : `${withoutDuplicateApiVersion}/api/v1`;
}

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL ?? baseConfig.extra?.apiUrl;
const resolvedApiUrl = configuredApiUrl ? normalizeApiUrl(configuredApiUrl) : undefined;
const configuredRevenueCatAndroidKey =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID?.trim() || baseConfig.extra?.revenueCatApiKeyAndroid;
const configuredRevenueCatIosKey =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS?.trim() || baseConfig.extra?.revenueCatApiKeyIos;
const configuredAllowMockPurchases = parseBooleanEnv(
  process.env.EXPO_PUBLIC_ALLOW_MOCK_PURCHASES,
  baseConfig.extra?.allowMockPurchases,
);
const configuredPushDebug = parseBooleanEnv(
  process.env.EXPO_PUBLIC_PUSH_DEBUG,
  baseConfig.extra?.pushDebug ?? false,
);
const buildProfile = process.env.EAS_BUILD_PROFILE ?? baseConfig.extra?.buildProfile;
const buildPlatform = process.env.EAS_BUILD_PLATFORM;
const googleServicesFile = resolveGoogleServicesFile();

if (buildProfile === 'production' && !configuredRevenueCatAndroidKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID for production build. Set the Google RevenueCat public key that starts with goog_ in EAS environment variables.',
  );
}

if (buildProfile === 'preview' && buildPlatform === 'android' && !isUsableDeviceApiUrl(resolvedApiUrl)) {
  throw new Error(
    'Missing usable EXPO_PUBLIC_API_URL for Android preview build. Set the EAS preview environment value to a public HTTPS staging/ngrok API URL, for example https://your-preview-api.example.com/api/v1.',
  );
}

if (buildProfile && buildPlatform === 'android' && !googleServicesFile) {
  throw new Error(
    'Missing google-services.json for Android EAS build. Set GOOGLE_SERVICES_JSON_BASE64 as a sensitive EAS environment variable or provide apps/mobile/google-services.json before building.',
  );
}

module.exports = () => {
  const android = {
    ...baseConfig.android,
  };

  if (googleServicesFile) {
    android.googleServicesFile = googleServicesFile;
  } else {
    delete android.googleServicesFile;
  }

  return {
    ...baseConfig,
    android,
    extra: {
      ...baseConfig.extra,
      apiUrl: resolvedApiUrl,
      apiDebug: process.env.EXPO_PUBLIC_API_LOGGING
        ? process.env.EXPO_PUBLIC_API_LOGGING === 'true'
        : baseConfig.extra?.apiDebug,
      revenueCatApiKeyAndroid: configuredRevenueCatAndroidKey,
      revenueCatApiKeyIos: configuredRevenueCatIosKey,
      allowMockPurchases: configuredAllowMockPurchases,
      pushDebug: configuredPushDebug,
      buildProfile,
    },
  };
};

function resolveGoogleServicesFile() {
  const encodedGoogleServices = process.env.GOOGLE_SERVICES_JSON_BASE64?.trim();

  if (encodedGoogleServices) {
    writeFileSync(googleServicesPath, Buffer.from(encodedGoogleServices, 'base64').toString('utf8'));
    return './google-services.json';
  }

  if (existsSync(googleServicesPath)) {
    return './google-services.json';
  }

  return undefined;
}

function isUsableDeviceApiUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      host !== 'localhost' &&
      host !== '127.0.0.1' &&
      host !== '0.0.0.0' &&
      !host.endsWith('.local') &&
      !/^10\./.test(host) &&
      !/^192\.168\./.test(host)
    );
  } catch {
    return false;
  }
}
