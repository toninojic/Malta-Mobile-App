import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { invalidateMarketplaceState, invalidateQueryKeys } from './invalidation';

export function useAiJobAssistant(enabled: boolean) {
  return useQuery({
    queryKey: ['ai-job-assistant', 'current'],
    queryFn: api.aiJobAssistantCurrent,
    enabled,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export function useCreateAiJobAssistantConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createAiJobAssistantConversation,
    onSuccess: (state) => {
      queryClient.setQueryData(['ai-job-assistant', 'current'], state);
    },
  });
}

export function useSendAiJobAssistantMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.sendAiJobAssistantMessage,
    onSuccess: async () => {
      await invalidateQueryKeys(queryClient, [['ai-job-assistant', 'current']]);
    },
  });
}

export function usePublishAiJobDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.publishAiJobDraft,
    onSuccess: async (result) => {
      await invalidateMarketplaceState(queryClient, { jobId: result.job.id });
      await invalidateQueryKeys(queryClient, [['ai-job-assistant', 'current']]);
    },
  });
}

export function useDiscardAiJobDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.discardAiJobDraft,
    onSuccess: async () => {
      await invalidateQueryKeys(queryClient, [['ai-job-assistant', 'current']]);
    },
  });
}
