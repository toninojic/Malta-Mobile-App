import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiConfig } from '../config/apiConfig';
import { getAccessToken } from '../store/auth.store';
import { AnalyticsEntityType, AnalyticsEventInput } from '../types/domain';

type TrackOptions = {
  screen?: string;
  entityType?: AnalyticsEntityType;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

const sessionId = createSessionId();
let lastScreenKey: string | null = null;

const screenEventMap: Record<string, string> = {
  Onboarding: 'APP_OPENED',
  Login: 'LOGIN_VIEWED',
  Register: 'REGISTER_VIEWED',
  EmployerJobs: 'JOBS_VIEWED',
  MyOffers: 'JOBS_VIEWED',
  JobDetails: 'JOB_DETAILS_VIEWED',
  JobForm: 'CREATE_JOB_VIEWED',
  OfferForm: 'OFFER_CREATE_STARTED',
  OfferWorkDetails: 'OFFER_DETAILS_VIEWED',
  ActivityHome: 'ACTIVITY_VIEWED',
  Conversations: 'MESSAGES_VIEWED',
  ConversationThread: 'CONVERSATION_VIEWED',
  WalletHome: 'WALLET_VIEWED',
  ProfileTab: 'PROFILE_VIEWED',
  AdminDashboardTab: 'ADMIN_DASHBOARD_VIEWED',
  AdminDashboard: 'ADMIN_DASHBOARD_VIEWED',
  VerifyEmail: 'EMAIL_VERIFY_LINK_OPENED',
};

export function track(eventName: string, options: TrackOptions = {}) {
  const payload: AnalyticsEventInput = {
    sessionId,
    eventName,
    screen: options.screen ?? 'UNKNOWN',
    entityType: options.entityType,
    entityId: options.entityId,
    metadata: sanitizeClientMetadata(options.metadata),
    platform: Platform.OS,
    appVersion: Constants.expoConfig?.version,
  };

  void sendAnalyticsEvent(payload);
}

export function trackScreenView(routeName?: string) {
  if (!routeName) {
    return;
  }

  const eventName = screenEventMap[routeName] ?? `${routeName}_VIEWED`;
  const key = `${eventName}:${routeName}`;
  if (lastScreenKey === key) {
    return;
  }

  lastScreenKey = key;
  track(eventName, { screen: routeName });
}

export function trackApiFailure(input: {
  path: string;
  method: string;
  status?: number;
  message?: string;
}) {
  track(input.status === 400 ? 'VALIDATION_ERROR' : 'API_ERROR', {
    screen: 'API',
    metadata: {
      path: input.path,
      method: input.method,
      status: input.status,
      errorMessage: input.message,
    },
  });
}

async function sendAnalyticsEvent(payload: AnalyticsEventInput) {
  if (!apiConfig.baseUrl || apiConfig.deviceTestingError) {
    return;
  }

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (apiConfig.shouldSkipNgrokBrowserWarning) {
      headers['ngrok-skip-browser-warning'] = 'true';
    }
    const accessToken = getAccessToken();
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    await fetch(`${apiConfig.baseUrl}/analytics/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (apiConfig.shouldLogDiagnostics) {
      console.info('[analytics] event dropped', error instanceof Error ? error.message : String(error));
    }
  }
}

function sanitizeClientMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) {
    return undefined;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (/password|token|secret|message|body|description|content|phone|email|contact|document|url|link/i.test(key)) {
      output[key] = '[redacted]';
    } else {
      output[key] = value;
    }
  }
  return output;
}

function createSessionId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
