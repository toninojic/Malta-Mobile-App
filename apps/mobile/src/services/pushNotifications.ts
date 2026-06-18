import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { QueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { invalidateMarketplaceState } from '../api/invalidation';
import { AuthUser, NotificationType } from '../types/domain';

export type PushNotificationData = {
  type?: NotificationType | string;
  jobId?: string;
  offerId?: string;
  contactId?: string;
  conversationId?: string;
  reviewId?: string;
  refundId?: string;
  target?: string;
};

export type PushRegistrationDiagnostics = {
  platform: string;
  permissionStatus: string | null;
  permissionGranted: boolean | null;
  projectId: string | null;
  expoPushToken: string | null;
  backendRegistrationStatus: 'idle' | 'pending' | 'success' | 'failed' | 'skipped';
  backendResponse: string | null;
  backendError: string | null;
  lastAttemptAt: string | null;
  userId: string | null;
};

let lastRegisteredUserId: string | null = null;
let registrationInFlight: Promise<void> | null = null;
let pushDiagnostics: PushRegistrationDiagnostics = {
  platform: Platform.OS,
  permissionStatus: null,
  permissionGranted: null,
  projectId: null,
  expoPushToken: null,
  backendRegistrationStatus: 'idle',
  backendResponse: null,
  backendError: null,
  lastAttemptAt: null,
  userId: null,
};
const pushDiagnosticsListeners = new Set<(diagnostics: PushRegistrationDiagnostics) => void>();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

export function getPushRegistrationDiagnostics() {
  return pushDiagnostics;
}

export function subscribePushRegistrationDiagnostics(listener: (diagnostics: PushRegistrationDiagnostics) => void) {
  pushDiagnosticsListeners.add(listener);
  listener(pushDiagnostics);

  return () => {
    pushDiagnosticsListeners.delete(listener);
  };
}

export function shouldShowPushDiagnostics() {
  const extra = Constants.expoConfig?.extra as { pushDebug?: boolean } | undefined;
  return extra?.pushDebug === true;
}

export async function registerExpoPushTokenForUser(user: AuthUser | null) {
  if (!user || Platform.OS === 'web') {
    setPushDiagnostics({
      platform: Platform.OS,
      backendRegistrationStatus: Platform.OS === 'web' ? 'skipped' : 'idle',
      backendError: Platform.OS === 'web' ? 'Expo push registration is skipped on web.' : null,
      userId: user?.id ?? null,
    });
    return;
  }

  if (lastRegisteredUserId === user.id && registrationInFlight) {
    return registrationInFlight;
  }

  registrationInFlight = doRegisterExpoPushToken(user).finally(() => {
    registrationInFlight = null;
  });

  return registrationInFlight;
}

export async function deactivateCurrentDevicePushToken() {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    const projectId = getExpoProjectId();
    if (!projectId) {
      return;
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    const tokens = await api.pushTokens();
    const currentToken = tokens.find((item) => item.expoPushToken === token.data && item.isActive);
    if (currentToken) {
      await api.deactivatePushToken(currentToken.id);
    }
  } catch (error) {
    console.warn('[push] device token cleanup failed', error instanceof Error ? error.message : String(error));
  }
}

async function doRegisterExpoPushToken(user: AuthUser) {
  setPushDiagnostics({
    platform: Platform.OS,
    backendRegistrationStatus: 'pending',
    backendError: null,
    backendResponse: null,
    lastAttemptAt: new Date().toISOString(),
    userId: user.id,
  });

  try {
    await configureAndroidChannels();

    const permission = await ensureNotificationPermission();
    setPushDiagnostics({
      permissionStatus: permission.status,
      permissionGranted: permission.granted,
    });
    console.info('[push] notification permission resolved', {
      status: permission.status,
      granted: permission.granted,
      userId: user.id,
    });

    if (!permission.granted) {
      setPushDiagnostics({
        backendRegistrationStatus: 'skipped',
        backendError: 'Notification permission is not granted.',
      });
      console.info('[push] permission denied', { status: permission.status, userId: user.id });
      return;
    }

    const projectId = getExpoProjectId();
    setPushDiagnostics({ projectId });
    console.info('[push] Expo project id resolved', {
      projectId: projectId ?? '[missing]',
      userId: user.id,
    });

    if (!projectId) {
      setPushDiagnostics({
        backendRegistrationStatus: 'skipped',
        backendError: 'Missing EAS project id.',
      });
      console.warn('[push] missing EAS project id; push token registration skipped');
      return;
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    setPushDiagnostics({ expoPushToken: token.data ?? null });
    console.info('[push] Expo push token returned', {
      userId: user.id,
      token: maskPushToken(token.data),
    });

    if (!token.data) {
      setPushDiagnostics({
        backendRegistrationStatus: 'skipped',
        backendError: 'Expo returned an empty push token.',
      });
      console.warn('[push] Expo returned empty push token');
      return;
    }

    const payload = {
      expoPushToken: token.data,
      platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'unknown',
      deviceId: `${Platform.OS}-${user.id}`,
      deviceName: getDeviceName(),
    } as const;

    console.info('[push] registering Expo push token with backend', {
      userId: user.id,
      bodyKeys: Object.keys(payload),
      token: maskPushToken(payload.expoPushToken),
      platform: payload.platform,
    });

    const response = await api.registerPushToken(payload);

    lastRegisteredUserId = user.id;
    setPushDiagnostics({
      backendRegistrationStatus: 'success',
      backendResponse: `Saved token ${response.id}`,
      backendError: null,
    });
    console.info('[push] Expo push token registered', {
      userId: user.id,
      platform: Platform.OS,
      token: maskPushToken(token.data),
      pushTokenId: response.id,
      isActive: response.isActive,
    });
  } catch (error) {
    setPushDiagnostics({
      backendRegistrationStatus: 'failed',
      backendError: error instanceof Error ? error.message : String(error),
    });
    console.warn('[push] registration failed', error instanceof Error ? error.message : String(error));
  }
}

export function subscribeToPushNotifications(input: {
  onReceive: (data: PushNotificationData) => void;
  onOpen: (data: PushNotificationData) => void;
}) {
  const received = Notifications.addNotificationReceivedListener((notification) => {
    input.onReceive(normalizeNotificationData(notification.request.content.data));
  });
  const opened = Notifications.addNotificationResponseReceivedListener((response) => {
    input.onOpen(normalizeNotificationData(response.notification.request.content.data));
  });

  void Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) {
        input.onOpen(normalizeNotificationData(response.notification.request.content.data));
      }
    })
    .catch((error) => {
      console.warn('[push] could not read initial notification response', error instanceof Error ? error.message : String(error));
    });

  return () => {
    received.remove();
    opened.remove();
  };
}

export async function invalidateAfterPush(queryClient: QueryClient, data: PushNotificationData) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    queryClient.invalidateQueries({ queryKey: ['messages', 'conversations'] }),
    queryClient.invalidateQueries({ queryKey: ['activity', 'summary'] }),
    invalidateMarketplaceState(queryClient, {
      offerId: data.offerId,
      jobId: data.jobId,
      contactId: data.contactId,
    }),
  ]);
}

function normalizeNotificationData(data: Record<string, unknown> | undefined): PushNotificationData {
  const input = data ?? {};
  return {
    type: typeof input.type === 'string' ? input.type : undefined,
    jobId: typeof input.jobId === 'string' ? input.jobId : undefined,
    offerId: typeof input.offerId === 'string' ? input.offerId : undefined,
    contactId: typeof input.contactId === 'string' ? input.contactId : undefined,
    conversationId: typeof input.conversationId === 'string' ? input.conversationId : undefined,
    reviewId: typeof input.reviewId === 'string' ? input.reviewId : undefined,
    refundId: typeof input.refundId === 'string' ? input.refundId : undefined,
    target: typeof input.target === 'string' ? input.target : undefined,
  };
}

async function ensureNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.status === 'granted') {
    return { granted: true, status: current.status ?? 'granted' };
  }

  const requested = await Notifications.requestPermissionsAsync();
  return {
    granted: Boolean(requested.granted || requested.status === 'granted'),
    status: requested.status ?? 'unknown',
  };
}

async function configureAndroidChannels() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Promise.all([
    Notifications.setNotificationChannelAsync('marketplace', {
      name: 'Marketplace updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#ED3A35',
    }),
    Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: '#ED3A35',
    }),
    Notifications.setNotificationChannelAsync('system', {
      name: 'Account and admin alerts',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#ED3A35',
    }),
  ]);
}

function getExpoProjectId() {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

function getDeviceName() {
  const maybeConstants = Constants as unknown as { deviceName?: string };
  return maybeConstants.deviceName ?? `${Platform.OS} device`;
}

function setPushDiagnostics(partial: Partial<PushRegistrationDiagnostics>) {
  pushDiagnostics = {
    ...pushDiagnostics,
    ...partial,
  };

  if (shouldShowPushDiagnostics()) {
    console.info('[push:diagnostics]', sanitizePushDiagnostics(pushDiagnostics));
  }

  pushDiagnosticsListeners.forEach((listener) => listener(pushDiagnostics));
}

export function maskPushToken(token?: string | null) {
  if (!token) {
    return '[missing]';
  }

  if (token.length <= 18) {
    return `${token.slice(0, 4)}...`;
  }

  return `${token.slice(0, 18)}...${token.slice(-8)}`;
}

function sanitizePushDiagnostics(diagnostics: PushRegistrationDiagnostics) {
  return {
    ...diagnostics,
    expoPushToken: maskPushToken(diagnostics.expoPushToken),
  };
}
