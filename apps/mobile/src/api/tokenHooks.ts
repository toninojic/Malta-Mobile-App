import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { invalidateQueryKeys } from './invalidation';

export function useTokenPackages() {
  return useQuery({
    queryKey: ['tokens', 'packages'],
    queryFn: api.tokenPackages,
    refetchOnWindowFocus: true,
  });
}

export function useTokenBalance() {
  return useQuery({
    queryKey: ['tokens', 'balance'],
    queryFn: api.tokenBalance,
    refetchOnWindowFocus: true,
  });
}

export function useTokenTransactions() {
  return useQuery({
    queryKey: ['tokens', 'transactions'],
    queryFn: () => api.tokenTransactions({ limit: 50 }),
    refetchOnWindowFocus: true,
  });
}

export function useMyRefunds() {
  return useQuery({
    queryKey: ['tokens', 'refunds', 'mine'],
    queryFn: () => api.myRefunds({ limit: 50 }),
    refetchOnWindowFocus: true,
  });
}

export function useAdminRefunds(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'tokens', 'refunds'],
    queryFn: () => api.adminRefunds({ limit: 100 }),
    enabled,
    refetchOnWindowFocus: true,
  });
}

export function useCreateRefund() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createRefund,
    onSuccess: async () => {
      await invalidateQueryKeys(queryClient, [
        ['tokens', 'refunds'],
        ['admin', 'tokens', 'refunds'],
        ['notifications'],
      ]);
    },
  });
}

export function useApproveRefund() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ refundRequestId, adminNote }: { refundRequestId: string; adminNote?: string }) =>
      api.approveRefund(refundRequestId, adminNote),
    onSuccess: async () => {
      await invalidateQueryKeys(queryClient, [
        ['tokens'],
        ['admin', 'tokens', 'refunds'],
        ['admin', 'statistics'],
        ['admin', 'audit-logs'],
        ['notifications'],
      ]);
    },
  });
}

export function useRejectRefund() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ refundRequestId, adminNote }: { refundRequestId: string; adminNote?: string }) =>
      api.rejectRefund(refundRequestId, adminNote),
    onSuccess: async () => {
      await invalidateQueryKeys(queryClient, [
        ['tokens', 'refunds'],
        ['admin', 'tokens', 'refunds'],
        ['admin', 'statistics'],
        ['admin', 'audit-logs'],
        ['notifications'],
      ]);
    },
  });
}
