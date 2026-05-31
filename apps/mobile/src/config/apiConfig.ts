import Constants from 'expo-constants';
import { Platform } from 'react-native';

type ExpoExtra = {
  apiUrl?: string;
  apiDebug?: boolean;
  buildProfile?: string;
};

export type ApiConfig = {
  baseUrl: string;
  source: 'EXPO_PUBLIC_API_URL' | 'expo.extra.apiUrl' | 'missing';
  healthUrl: string;
  isConfigured: boolean;
  isHttps: boolean;
  isPrivateHost: boolean;
  shouldSkipNgrokBrowserWarning: boolean;
  shouldLogDiagnostics: boolean;
  deviceTestingError: string | null;
};

export const apiConfig = resolveApiConfig();

export function logApiStartupDiagnostics() {
  if (!apiConfig.shouldLogDiagnostics) {
    return;
  }

  console.info('[api:config]', {
    baseUrl: apiConfig.baseUrl || '[missing]',
    source: apiConfig.source,
    isHttps: apiConfig.isHttps,
    isPrivateHost: apiConfig.isPrivateHost,
    healthUrl: apiConfig.healthUrl || '[missing]',
    deviceTestingError: apiConfig.deviceTestingError,
  });
}

function resolveApiConfig(): ApiConfig {
  const extra = getExpoExtra();
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  const extraUrl = extra.apiUrl?.trim();
  const source = envUrl ? 'EXPO_PUBLIC_API_URL' : extraUrl ? 'expo.extra.apiUrl' : 'missing';
  const rawUrl = envUrl || extraUrl || '';
  const baseUrl = rawUrl ? normalizeApiBaseUrl(rawUrl) : '';
  const url = parseUrl(baseUrl);
  const host = url?.hostname ?? '';
  const isConfigured = Boolean(url);
  const isHttps = url?.protocol === 'https:';
  const isPrivateHost = isPrivateHostname(host);
  const shouldLogDiagnostics =
    process.env.EXPO_PUBLIC_API_LOGGING === 'true' || extra.apiDebug === true || isDevRuntime();
  const shouldSkipNgrokBrowserWarning = host.includes('ngrok');

  return {
    baseUrl,
    source,
    healthUrl: baseUrl ? `${baseUrl}/health` : '',
    isConfigured,
    isHttps,
    isPrivateHost,
    shouldSkipNgrokBrowserWarning,
    shouldLogDiagnostics,
    deviceTestingError: getDeviceTestingError({ isConfigured, isHttps, isPrivateHost }),
  };
}

function normalizeApiBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '');
  const withoutDuplicateApiVersion = trimmed.replace(/(\/api\/v1)+$/, '/api/v1');
  return withoutDuplicateApiVersion.endsWith('/api/v1')
    ? withoutDuplicateApiVersion
    : `${withoutDuplicateApiVersion}/api/v1`;
}

function getExpoExtra() {
  return (Constants.expoConfig?.extra ?? {}) as ExpoExtra;
}

function parseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function getDeviceTestingError(input: { isConfigured: boolean; isHttps: boolean; isPrivateHost: boolean }) {
  if (Platform.OS === 'web') {
    return null;
  }

  if (!input.isConfigured) {
    return 'Missing API URL. Configure EXPO_PUBLIC_API_URL with a public HTTPS URL.';
  }

  if (!input.isHttps || input.isPrivateHost) {
    return 'Invalid API URL for device testing. Use a public HTTPS URL such as ngrok.';
  }

  return null;
}

function isDevRuntime() {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function isPrivateHostname(hostname: string) {
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
