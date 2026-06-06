import { useQuery } from '@tanstack/react-query';
import { api } from './client';

const ACTIVITY_POLL_INTERVAL_MS = 45_000;

export function useActivitySummary(enabled = true, poll = false) {
  return useQuery({
    queryKey: ['activity', 'summary'],
    queryFn: api.activitySummary,
    enabled,
    staleTime: 30_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchInterval: enabled && poll ? ACTIVITY_POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });
}
