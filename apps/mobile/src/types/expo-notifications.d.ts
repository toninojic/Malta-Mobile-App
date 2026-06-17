declare module 'expo-notifications' {
  export type Subscription = { remove: () => void };
  export type NotificationResponse = { notification: { request: { content: { data?: Record<string, unknown> } } } };
  export type Notification = { request: { content: { data?: Record<string, unknown> } } };

  export const AndroidImportance: { MAX: number; HIGH: number; DEFAULT: number };

  export function setNotificationHandler(handler: {
    handleNotification: () => Promise<Record<string, unknown>>;
  }): void;
  export function getPermissionsAsync(): Promise<{ status: string; granted?: boolean }>;
  export function requestPermissionsAsync(): Promise<{ status: string; granted?: boolean }>;
  export function getExpoPushTokenAsync(options?: { projectId?: string }): Promise<{ data: string }>;
  export function setNotificationChannelAsync(
    channelId: string,
    options: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null>;
  export function addNotificationReceivedListener(
    listener: (notification: Notification) => void,
  ): Subscription;
  export function addNotificationResponseReceivedListener(
    listener: (response: NotificationResponse) => void,
  ): Subscription;
  export function getLastNotificationResponseAsync(): Promise<NotificationResponse | null>;
}

