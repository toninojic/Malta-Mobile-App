import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { invalidateQueryKeys } from './invalidation';

export function useBlockedUsers(enabled = true) {
  return useQuery({
    queryKey: ['users', 'blocked'],
    queryFn: api.blockedUsers,
    enabled,
  });
}

export function useBlockUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.blockUser,
    onSuccess: async () => {
      await invalidateBlockingQueries(queryClient);
    },
  });
}

export function useUnblockUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.unblockUser,
    onSuccess: async () => {
      await invalidateBlockingQueries(queryClient);
    },
  });
}

function invalidateBlockingQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return invalidateQueryKeys(queryClient, [
    ['users', 'blocked'],
    ['messages', 'conversations'],
    ['messages', 'conversation'],
    ['messages', 'conversation-details'],
  ]);
}
