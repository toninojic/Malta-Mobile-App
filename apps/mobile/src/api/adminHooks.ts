import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { JobStatus, OfferStatus, RefundStatus, UserRole, UserStatus } from '../types/domain';
import { api } from './client';

export function useAdminStatistics(enabled = true) {
  return useQuery({
    queryKey: ['admin', 'statistics'],
    queryFn: api.adminStatistics,
    enabled,
    refetchInterval: enabled ? 15_000 : false,
  });
}

export function useAdminUsers(input: { role?: UserRole; status?: UserStatus; search?: string } = {}, enabled = true) {
  return useQuery({
    queryKey: ['admin', 'users', input],
    queryFn: () => api.adminUsers({ ...input, limit: 50 }),
    enabled,
  });
}

export function useAdminJobs(input: { status?: JobStatus; category?: string; location?: string } = {}, enabled = true) {
  return useQuery({
    queryKey: ['admin', 'jobs', input],
    queryFn: () => api.adminJobs({ ...input, limit: 50 }),
    enabled,
  });
}

export function useAdminOffers(input: { status?: OfferStatus } = {}, enabled = true) {
  return useQuery({
    queryKey: ['admin', 'offers', input],
    queryFn: () => api.adminOffers({ ...input, limit: 50 }),
    enabled,
  });
}

export function useAdminAuditLogs(enabled = true) {
  return useQuery({
    queryKey: ['admin', 'audit-logs'],
    queryFn: () => api.adminAuditLogs({ limit: 50 }),
    enabled,
  });
}

export function useAdminConversationMessages(conversationId?: string) {
  return useQuery({
    queryKey: ['admin', 'conversation', conversationId, 'messages'],
    queryFn: () => api.adminConversationMessages(conversationId as string),
    enabled: Boolean(conversationId),
  });
}

export function useSuspendUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.suspendUser,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'statistics'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] }),
      ]);
    },
  });
}

export function useActivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.activateUser,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'statistics'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] }),
      ]);
    },
  });
}

export function useCloseAdminJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.closeAdminJob,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'statistics'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] }),
      ]);
    },
  });
}

export function useAdminRefundsForModeration(enabled = true, status?: RefundStatus) {
  return useQuery({
    queryKey: ['admin', 'tokens', 'refunds', status],
    queryFn: () => api.adminRefunds({ status, limit: 50 }),
    enabled,
  });
}
