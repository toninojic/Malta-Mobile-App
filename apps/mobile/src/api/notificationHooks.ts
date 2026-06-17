import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { invalidateQueryKeys } from './invalidation';

const ALERTS_POLL_INTERVAL_MS = 12_000;

export function useNotifications(enabled = true, poll = false) {
  return useQuery({
    queryKey: ['notifications', 'mine'],
    queryFn: () => api.notifications({ limit: 50 }),
    enabled,
    refetchInterval: enabled && poll ? ALERTS_POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useAdminNotifications(enabled: boolean, poll = false) {
  return useQuery({
    queryKey: ['admin', 'notifications'],
    queryFn: () => api.adminNotifications({ limit: 100 }),
    enabled,
    refetchInterval: enabled && poll ? ALERTS_POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useUnreadNotificationCount(enabled = true, poll = false) {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: api.unreadNotificationCount,
    enabled,
    refetchInterval: enabled && poll ? ALERTS_POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.markNotificationRead,
    onSuccess: async () => {
      await invalidateQueryKeys(queryClient, [
        ['notifications'],
        ['activity', 'summary'],
        ['messages', 'conversations'],
      ]);
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: async () => {
      await invalidateQueryKeys(queryClient, [
        ['notifications'],
        ['activity', 'summary'],
        ['messages', 'conversations'],
      ]);
    },
  });
}

export function useNotificationPreferences(enabled = true) {
  return useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: api.notificationPreferences,
    enabled,
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.updateNotificationPreferences,
    onSuccess: async () => {
      await invalidateQueryKeys(queryClient, [
        ['notifications', 'preferences'],
        ['notifications', 'unread-count'],
      ]);
    },
  });
}
