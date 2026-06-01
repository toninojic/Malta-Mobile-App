import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: ['notifications', 'mine'],
    queryFn: () => api.notifications({ limit: 50 }),
    enabled,
    refetchInterval: enabled ? 10_000 : false,
  });
}

export function useAdminNotifications(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'notifications'],
    queryFn: () => api.adminNotifications({ limit: 100 }),
    enabled,
    refetchInterval: enabled ? 10_000 : false,
  });
}

export function useUnreadNotificationCount(enabled = true) {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: api.unreadNotificationCount,
    enabled,
    refetchInterval: enabled ? 10_000 : false,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.markNotificationRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
