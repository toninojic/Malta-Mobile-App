import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { invalidateMarketplaceState } from './invalidation';

export function useUnlockStatus(offerId?: string) {
  return useQuery({
    queryKey: ['contacts', 'unlock-status', offerId],
    queryFn: () => api.unlockStatus(offerId as string),
    enabled: Boolean(offerId),
    refetchOnWindowFocus: true,
  });
}

export function useContacts(enabled = true) {
  return useQuery({
    queryKey: ['contacts', 'mine'],
    queryFn: () => api.contacts({ limit: 50 }),
    enabled,
    refetchOnWindowFocus: true,
  });
}

export function useContact(contactId?: string, admin = false) {
  return useQuery({
    queryKey: [admin ? 'admin' : 'contacts', 'details', contactId],
    queryFn: () => (admin ? api.adminContact(contactId as string) : api.contact(contactId as string)),
    enabled: Boolean(contactId),
    refetchOnWindowFocus: true,
  });
}

export function useAdminContacts(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'contacts'],
    queryFn: () => api.adminContacts({ limit: 100 }),
    enabled,
    refetchOnWindowFocus: true,
  });
}

export function useUnlockOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.unlockOffer,
    onSuccess: async (result) => {
      await invalidateMarketplaceState(queryClient, {
        contactId: result.contact.id,
        jobId: result.contact.jobRequestId,
        offerId: result.contact.offerId,
        includeTokens: true,
      });
    },
  });
}

export function useRequestContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.requestContact,
    onSuccess: async (result) => {
      await invalidateMarketplaceState(queryClient, {
        contactId: result.contactId,
        offerId: result.offerId,
      });
    },
  });
}
