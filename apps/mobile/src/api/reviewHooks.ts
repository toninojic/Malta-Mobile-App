import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export function useCompletionStatus(contactId?: string) {
  return useQuery({
    queryKey: ['reviews', 'completion-status', contactId],
    queryFn: () => api.completionStatus(contactId as string),
    enabled: Boolean(contactId),
  });
}

export function useCompleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.completeContact,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['contacts'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
    },
  });
}

export function useConfirmCompletion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.confirmCompletion,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['contacts'] }),
        queryClient.invalidateQueries({ queryKey: ['jobs'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
    },
  });
}

export function useCreateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contactId, rating, comment }: { contactId: string; rating: number; comment?: string }) =>
      api.createReview(contactId, { rating, comment }),
    onSuccess: async (review) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['contractors', review.contractorId] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
    },
  });
}

export function useReview(reviewId?: string, admin = false) {
  return useQuery({
    queryKey: [admin ? 'admin' : 'reviews', 'details', reviewId],
    queryFn: () => (admin ? api.adminReview(reviewId as string) : api.review(reviewId as string)),
    enabled: Boolean(reviewId),
  });
}

export function useContractorReviews(contractorId?: string) {
  return useQuery({
    queryKey: ['contractors', contractorId, 'reviews'],
    queryFn: () => api.contractorReviews(contractorId as string, { limit: 50 }),
    enabled: Boolean(contractorId),
  });
}

export function useContractorRatingSummary(contractorId?: string) {
  return useQuery({
    queryKey: ['contractors', contractorId, 'rating-summary'],
    queryFn: () => api.contractorRatingSummary(contractorId as string),
    enabled: Boolean(contractorId),
  });
}

export function useReplyReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId, contractorReply }: { reviewId: string; contractorReply: string }) =>
      api.replyReview(reviewId, contractorReply),
    onSuccess: async (review) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['contractors', review.contractorId] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
    },
  });
}

export function useAdminReviews(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'reviews'],
    queryFn: () => api.adminReviews({ limit: 100 }),
    enabled,
  });
}

export function useRemoveReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.removeReview,
    onSuccess: async (review) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'statistics'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] }),
        queryClient.invalidateQueries({ queryKey: ['reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['contractors', review.contractorId] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
    },
  });
}
