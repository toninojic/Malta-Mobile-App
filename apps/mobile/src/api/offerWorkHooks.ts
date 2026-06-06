import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { invalidateMarketplaceState } from './invalidation';

export function useOfferWorkDetails(offerId?: string) {
  return useQuery({
    queryKey: ['offers', 'work-details', offerId],
    queryFn: () => api.offerWorkDetails(offerId as string),
    enabled: Boolean(offerId),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useUploadPortfolioImages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.uploadPortfolioImages,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contractors', 'portfolio'] }),
        queryClient.invalidateQueries({ queryKey: ['users', 'me'] }),
      ]);
    },
  });
}

export function useRemovePortfolioImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.removePortfolioImage,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contractors', 'portfolio'] }),
        queryClient.invalidateQueries({ queryKey: ['users', 'me'] }),
      ]);
    },
  });
}

export function usePortfolioImages(enabled = true) {
  return useQuery({
    queryKey: ['contractors', 'portfolio', 'mine'],
    queryFn: api.portfolioImages,
    enabled,
  });
}

export function useContractorVerification(enabled = true) {
  return useQuery({
    queryKey: ['contractors', 'verification', 'mine'],
    queryFn: api.contractorVerification,
    enabled,
  });
}

export function useUploadContractorVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.uploadContractorVerification,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contractors', 'verification'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'contractor-verifications'] }),
        queryClient.invalidateQueries({ queryKey: ['users', 'me'] }),
      ]);
    },
  });
}

export function useAdminContractorVerifications(enabled = true) {
  return useQuery({
    queryKey: ['admin', 'contractor-verifications'],
    queryFn: () => api.adminContractorVerifications({ limit: 100 }),
    enabled,
  });
}

export function useApproveContractorVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.approveContractorVerification,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'contractor-verifications'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'statistics'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
    },
  });
}

export function useRejectContractorVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, adminNote }: { id: string; adminNote?: string }) => api.rejectContractorVerification(id, adminNote),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'contractor-verifications'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'statistics'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
    },
  });
}

export async function refreshWorkState(queryClient: QueryClient, input: { offerId?: string; jobId?: string; contactId?: string }) {
  await invalidateMarketplaceState(queryClient, {
    offerId: input.offerId,
    jobId: input.jobId,
    contactId: input.contactId,
  });
}
