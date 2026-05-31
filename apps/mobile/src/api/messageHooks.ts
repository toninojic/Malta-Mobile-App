import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export function useConversations(enabled = true) {
  return useQuery({
    queryKey: ['messages', 'conversations'],
    queryFn: () => api.conversations({ limit: 50 }),
    enabled,
  });
}

export function useAdminConversations(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'messages', 'conversations'],
    queryFn: () => api.adminConversations({ limit: 100 }),
    enabled,
  });
}

export function useConversationMessages(conversationId?: string, poll = false) {
  return useQuery({
    queryKey: ['messages', 'conversation', conversationId],
    queryFn: () => api.conversationMessages(conversationId as string),
    enabled: Boolean(conversationId),
    refetchInterval: poll ? 3000 : false,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => api.sendMessage(id, content),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['messages'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['messages', 'conversation', result.conversation.id] }),
      ]);
    },
  });
}

export function useMarkMessageRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.markMessageRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}
