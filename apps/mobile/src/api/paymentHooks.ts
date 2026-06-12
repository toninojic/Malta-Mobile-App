import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { invalidateQueryKeys } from './invalidation';
import { purchaseTokenPackageWithRevenueCat } from '../services/revenueCatPurchases';
import { TokenPackage } from '../types/domain';

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

export function useRevenueCatPurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tokenPackage: TokenPackage) => purchaseTokenPackageWithRevenueCat(tokenPackage),
    onSuccess: async () => {
      await invalidateQueryKeys(queryClient, [
        ['tokens', 'balance'],
        ['tokens', 'transactions'],
        ['payments'],
      ]);
    },
  });
}
