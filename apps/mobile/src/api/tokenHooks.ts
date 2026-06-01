import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export function useTokenPackages() {
  return useQuery({
    queryKey: ['tokens', 'packages'],
    queryFn: api.tokenPackages,
  });
}

export function useTokenBalance() {
  return useQuery({
    queryKey: ['tokens', 'balance'],
    queryFn: api.tokenBalance,
  });
}

export function useTokenTransactions() {
  return useQuery({
    queryKey: ['tokens', 'transactions'],
    queryFn: () => api.tokenTransactions({ limit: 50 }),
  });
}

export function useMyRefunds() {
  return useQuery({
    queryKey: ['tokens', 'refunds', 'mine'],
    queryFn: () => api.myRefunds({ limit: 50 }),
  });
}

export function useAdminRefunds(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'tokens', 'refunds'],
    queryFn: () => api.adminRefunds({ limit: 100 }),
    enabled,
  });
}

export function useCreateRefund() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createRefund,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tokens', 'refunds'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'tokens', 'refunds'] }),
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tokens'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'tokens', 'refunds'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'statistics'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] }),
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tokens', 'refunds'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'tokens', 'refunds'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'statistics'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] }),
      ]);
    },
  });
}
