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

let lastRegisteredUserId: string | null = null;
let registrationInFlight: Promise<void> | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

export async function registerExpoPushTokenForUser(user: AuthUser | null) {
  if (!user || Platform.OS === 'web') {
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
  try {
    await configureAndroidChannels();

    const permission = await ensureNotificationPermission();
    if (!permission) {
      console.info('[push] permission denied');
      return;
    }

    const projectId = getExpoProjectId();
    if (!projectId) {
      console.warn('[push] missing EAS project id; push token registration skipped');
      return;
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token.data) {
      console.warn('[push] Expo returned empty push token');
      return;
    }

    await api.registerPushToken({
      expoPushToken: token.data,
      platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'unknown',
      deviceId: `${Platform.OS}-${user.id}`,
      deviceName: getDeviceName(),
    });

    lastRegisteredUserId = user.id;
    console.info('[push] Expo push token registered', {
      userId: user.id,
      platform: Platform.OS,
      tokenPrefix: token.data.slice(0, 18),
    });
  } catch (error) {
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
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return Boolean(requested.granted || requested.status === 'granted');
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
