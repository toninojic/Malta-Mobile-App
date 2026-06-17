const baseConfig = require('./app.json').expo;

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
const configuredRevenueCatAndroidKey =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID?.trim() || baseConfig.extra?.revenueCatApiKeyAndroid;
const configuredRevenueCatIosKey =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS?.trim() || baseConfig.extra?.revenueCatApiKeyIos;
const configuredAllowMockPurchases = parseBooleanEnv(
  process.env.EXPO_PUBLIC_ALLOW_MOCK_PURCHASES,
  baseConfig.extra?.allowMockPurchases,
);
const buildProfile = process.env.EAS_BUILD_PROFILE ?? baseConfig.extra?.buildProfile;

if (buildProfile === 'production' && !configuredRevenueCatAndroidKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID for production build. Set the Google RevenueCat public key that starts with goog_ in EAS environment variables.',
  );
}

module.exports = () => ({
  ...baseConfig,
  extra: {
    ...baseConfig.extra,
    apiUrl: configuredApiUrl ? normalizeApiUrl(configuredApiUrl) : undefined,
    apiDebug: process.env.EXPO_PUBLIC_API_LOGGING
      ? process.env.EXPO_PUBLIC_API_LOGGING === 'true'
      : baseConfig.extra?.apiDebug,
    revenueCatApiKeyAndroid: configuredRevenueCatAndroidKey,
    revenueCatApiKeyIos: configuredRevenueCatIosKey,
    allowMockPurchases: configuredAllowMockPurchases,
    buildProfile,
  },
});
