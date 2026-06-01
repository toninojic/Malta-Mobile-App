import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export function usePayments() {
  return useQuery({
    queryKey: ['payments'],
    queryFn: () => api.payments({ limit: 50 }),
  });
}

export function useCreateCheckoutSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createCheckoutSession,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}
