import { NotificationPreference, NotificationType, UserRole } from '@prisma/client';

export type NotificationPreferenceKey =
  | 'newJobsNearMe'
  | 'offerUpdates'
  | 'messages'
  | 'reviews'
  | 'paymentsRefunds'
  | 'systemAlerts'
  | 'adminAlerts';

export const NOTIFICATION_TYPE_PREFERENCE: Partial<Record<NotificationType, NotificationPreferenceKey>> = {
  [NotificationType.NEW_JOB_NEARBY]: 'newJobsNearMe',
  [NotificationType.NEW_OFFER]: 'offerUpdates',
  [NotificationType.OFFER_SELECTED]: 'offerUpdates',
  [NotificationType.CONTACT_UNLOCKED]: 'offerUpdates',
  [NotificationType.JOB_COMPLETED]: 'offerUpdates',
  [NotificationType.NEW_MESSAGE]: 'messages',
  [NotificationType.REVIEW_RECEIVED]: 'reviews',
  [NotificationType.REVIEW_REPLIED]: 'reviews',
  [NotificationType.REVIEW_REMOVED]: 'reviews',
  [NotificationType.REFUND_APPROVED]: 'paymentsRefunds',
  [NotificationType.REFUND_DENIED]: 'paymentsRefunds',
  [NotificationType.REFUND_REJECTED]: 'paymentsRefunds',
  [NotificationType.ACCOUNT_SUSPENDED]: 'systemAlerts',
  [NotificationType.ACCOUNT_ACTIVATED]: 'systemAlerts',
  [NotificationType.CONTRACTOR_VERIFICATION_APPROVED]: 'systemAlerts',
  [NotificationType.CONTRACTOR_VERIFICATION_REJECTED]: 'systemAlerts',
  [NotificationType.SYSTEM_ALERT]: 'systemAlerts',
  [NotificationType.REPORT_STATUS_UPDATED]: 'systemAlerts',
  [NotificationType.NEW_REPORT]: 'adminAlerts',
  [NotificationType.NEW_VERIFICATION_REQUEST]: 'adminAlerts',
  [NotificationType.NEW_REFUND_REQUEST]: 'adminAlerts',
};

export function defaultNotificationPreferences(role: UserRole) {
  if (role === UserRole.CONTRACTOR) {
    return {
      newJobsNearMe: true,
      offerUpdates: true,
      messages: true,
      reviews: true,
      paymentsRefunds: true,
      systemAlerts: true,
      adminAlerts: false,
    };
  }

  if (role === UserRole.ADMIN) {
    return {
      newJobsNearMe: false,
      offerUpdates: false,
      messages: true,
      reviews: true,
      paymentsRefunds: true,
      systemAlerts: true,
      adminAlerts: true,
    };
  }

  return {
    newJobsNearMe: false,
    offerUpdates: true,
    messages: true,
    reviews: true,
    paymentsRefunds: true,
    systemAlerts: true,
    adminAlerts: false,
  };
}

export function isNotificationEnabled(
  role: UserRole,
  preference: NotificationPreference | null | undefined,
  type: NotificationType,
) {
  const key = NOTIFICATION_TYPE_PREFERENCE[type];

  if (!key) {
    return true;
  }

  return preference?.[key] ?? defaultNotificationPreferences(role)[key];
}
