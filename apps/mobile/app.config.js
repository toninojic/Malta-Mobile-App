const baseConfig = require('./app.json').expo;

function normalizeApiUrl(value) {
  const trimmed = String(value).trim().replace(/\/+$/, '');
  const withoutDuplicateApiVersion = trimmed.replace(/(\/api\/v1)+$/, '/api/v1');
  return withoutDuplicateApiVersion.endsWith('/api/v1')
    ? withoutDuplicateApiVersion
    : `${withoutDuplicateApiVersion}/api/v1`;
}

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL ?? baseConfig.extra?.apiUrl;

module.exports = () => ({
  ...baseConfig,
  extra: {
    ...baseConfig.extra,
    apiUrl: configuredApiUrl ? normalizeApiUrl(configuredApiUrl) : undefined,
    apiDebug: process.env.EXPO_PUBLIC_API_LOGGING
      ? process.env.EXPO_PUBLIC_API_LOGGING === 'true'
      : baseConfig.extra?.apiDebug,
    buildProfile: process.env.EAS_BUILD_PROFILE ?? baseConfig.extra?.buildProfile,
  },
});
