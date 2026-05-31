import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export function useUnlockStatus(offerId?: string) {
  return useQuery({
    queryKey: ['contacts', 'unlock-status', offerId],
    queryFn: () => api.unlockStatus(offerId as string),
    enabled: Boolean(offerId),
  });
}

export function useContacts(enabled = true) {
  return useQuery({
    queryKey: ['contacts', 'mine'],
    queryFn: () => api.contacts({ limit: 50 }),
    enabled,
  });
}

export function useContact(contactId?: string, admin = false) {
  return useQuery({
    queryKey: [admin ? 'admin' : 'contacts', 'details', contactId],
    queryFn: () => (admin ? api.adminContact(contactId as string) : api.contact(contactId as string)),
    enabled: Boolean(contactId),
  });
}

export function useAdminContacts(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'contacts'],
    queryFn: () => api.adminContacts({ limit: 100 }),
    enabled,
  });
}

export function useUnlockOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.unlockOffer,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contacts'] }),
        queryClient.invalidateQueries({ queryKey: ['offers'] }),
        queryClient.invalidateQueries({ queryKey: ['tokens'] }),
      ]);
    },
  });
}

export function useRequestContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.requestContact,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contacts'] }),
        queryClient.invalidateQueries({ queryKey: ['offers'] }),
      ]);
    },
  });
}
