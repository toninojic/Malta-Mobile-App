import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { invalidateQueryKey, invalidateQueryKeys } from './invalidation';

export function usePayments() {
  return useQuery({
    queryKey: ['payments'],
    queryFn: () => api.payments({ limit: 50 }),
    refetchOnWindowFocus: true,
  });
}

export function usePaymentConfig() {
  return useQuery({
    queryKey: ['payments', 'config'],
    queryFn: api.paymentConfig,
    refetchOnWindowFocus: true,
  });
}

export function useCreateCheckoutSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createCheckoutSession,
    onSuccess: async () => {
      await invalidateQueryKey(queryClient, ['payments']);
    },
  });
}

export function useMockPurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.mockPurchase,
    onSuccess: async () => {
      await invalidateQueryKeys(queryClient, [
        ['tokens', 'balance'],
        ['tokens', 'transactions'],
        ['tokens', 'refunds'],
        ['payments'],
      ]);
    },
  });
}
