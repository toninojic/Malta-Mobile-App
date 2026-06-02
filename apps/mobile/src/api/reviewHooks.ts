import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { invalidateMarketplaceState } from './invalidation';

export function useCompletionStatus(contactId?: string) {
  return useQuery({
    queryKey: ['reviews', 'completion-status', contactId],
    queryFn: () => api.completionStatus(contactId as string),
    enabled: Boolean(contactId),
    refetchOnWindowFocus: true,
  });
}

export function useCompleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.completeContact,
    onSuccess: async (completion) => {
      await invalidateMarketplaceState(queryClient, {
        contactId: completion.contactUnlockId,
        jobId: completion.jobRequestId,
        offerId: completion.offerId,
        contractorId: completion.contractorId,
        includeReviews: true,
      });
    },
  });
}

export function useConfirmCompletion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.confirmCompletion,
    onSuccess: async (completion) => {
      await invalidateMarketplaceState(queryClient, {
        contactId: completion.contactUnlockId,
        jobId: completion.jobRequestId,
        offerId: completion.offerId,
        contractorId: completion.contractorId,
        includeReviews: true,
      });
    },
  });
}

export function useCreateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contactId, rating, comment }: { contactId: string; rating: number; comment?: string }) =>
      api.createReview(contactId, { rating, comment }),
    onSuccess: async (review) => {
      await invalidateMarketplaceState(queryClient, {
        contactId: review.contactUnlockId,
        jobId: review.jobRequestId,
        offerId: review.offerId,
        contractorId: review.contractorId,
        reviewId: review.id,
        includeReviews: true,
      });
    },
  });
}

export function useReview(reviewId?: string, admin = false) {
  return useQuery({
    queryKey: [admin ? 'admin' : 'reviews', 'details', reviewId],
    queryFn: () => (admin ? api.adminReview(reviewId as string) : api.review(reviewId as string)),
    enabled: Boolean(reviewId),
    refetchOnWindowFocus: true,
  });
}

export function useContractorReviews(contractorId?: string) {
  return useQuery({
    queryKey: ['contractors', contractorId, 'reviews'],
    queryFn: () => api.contractorReviews(contractorId as string, { limit: 50 }),
    enabled: Boolean(contractorId),
    refetchOnWindowFocus: true,
  });
}

export function useContractorRatingSummary(contractorId?: string) {
  return useQuery({
    queryKey: ['contractors', contractorId, 'rating-summary'],
    queryFn: () => api.contractorRatingSummary(contractorId as string),
    enabled: Boolean(contractorId),
    refetchOnWindowFocus: true,
  });
}

export function useReplyReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId, contractorReply }: { reviewId: string; contractorReply: string }) =>
      api.replyReview(reviewId, contractorReply),
    onSuccess: async (review) => {
      await invalidateMarketplaceState(queryClient, {
        contactId: review.contactUnlockId,
        jobId: review.jobRequestId,
        offerId: review.offerId,
        contractorId: review.contractorId,
        reviewId: review.id,
        includeReviews: true,
      });
    },
  });
}

export function useAdminReviews(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'reviews'],
    queryFn: () => api.adminReviews({ limit: 100 }),
    enabled,
    refetchOnWindowFocus: true,
  });
}

export function useRemoveReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.removeReview,
    onSuccess: async (review) => {
      await invalidateMarketplaceState(queryClient, {
        contactId: review.contactUnlockId,
        jobId: review.jobRequestId,
        offerId: review.offerId,
        contractorId: review.contractorId,
        reviewId: review.id,
        includeAdmin: true,
        includeReviews: true,
      });
    },
  });
}
