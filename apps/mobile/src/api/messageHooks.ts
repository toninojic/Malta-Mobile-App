import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { appendMessage, invalidateQueryKeys } from './invalidation';
import { ChatMessage } from '../types/domain';

const CONVERSATION_LIST_POLL_INTERVAL_MS = 20_000;
const ADMIN_CONVERSATION_LIST_POLL_INTERVAL_MS = 30_000;
const CONVERSATION_THREAD_POLL_INTERVAL_MS = 3_000;

export function useConversations(enabled = true, poll = false) {
  return useQuery({
    queryKey: ['messages', 'conversations'],
    queryFn: () => api.conversations({ limit: 50 }),
    enabled,
    refetchInterval: enabled && poll ? CONVERSATION_LIST_POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useAdminConversations(enabled: boolean, poll = false) {
  return useQuery({
    queryKey: ['admin', 'messages', 'conversations'],
    queryFn: () => api.adminConversations({ limit: 100 }),
    enabled,
    refetchInterval: enabled && poll ? ADMIN_CONVERSATION_LIST_POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useConversationMessages(conversationId?: string, poll = false) {
  return useQuery({
    queryKey: ['messages', 'conversation', conversationId],
    queryFn: () => api.conversationMessages(conversationId as string),
    enabled: Boolean(conversationId),
    refetchInterval: poll ? CONVERSATION_THREAD_POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    placeholderData: (previousData) => previousData,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => api.sendMessage(id, content),
    onSuccess: async (result) => {
      appendMessage(queryClient, result.conversation.id, result.message);
      await invalidateQueryKeys(queryClient, [
        ['messages', 'conversations'],
        ['messages', 'conversation', result.conversation.id],
        ['notifications'],
        ['activity', 'summary'],
      ]);
    },
  });
}

export function useEnsureConversationForContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.ensureConversationForContact,
    onSuccess: async (conversation) => {
      await invalidateQueryKeys(queryClient, [
        ['messages', 'conversations'],
        ['messages', 'conversation', conversation.id],
        ['activity', 'summary'],
      ]);
    },
  });
}

export function useMarkMessageRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.markMessageRead,
    onSuccess: async (message) => {
      queryClient.setQueryData<ChatMessage[]>(['messages', 'conversation', message.conversationId], (messages) =>
        messages?.map((currentMessage) => (currentMessage.id === message.id ? message : currentMessage)),
      );
      await invalidateQueryKeys(queryClient, [
        ['messages', 'conversations'],
        ['notifications', 'unread-count'],
        ['activity', 'summary'],
      ]);
    },
  });
}
