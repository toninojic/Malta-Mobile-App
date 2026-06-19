import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ReportReason, ReportStatus, ReportTargetType } from '../types/domain';
import { api } from './client';
import { invalidateQueryKeys } from './invalidation';

export function useCreateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      targetType: ReportTargetType;
      targetId: string;
      reason: ReportReason;
      description?: string;
    }) => api.createReport(input),
    onSuccess: async () => {
      await invalidateQueryKeys(queryClient, [
        ['reports', 'mine'],
        ['admin', 'reports'],
        ['notifications'],
      ]);
    },
  });
}

export function useMyReports(input: {
  status?: ReportStatus;
  targetType?: ReportTargetType;
  reason?: ReportReason;
} = {}, enabled = true) {
  return useQuery({
    queryKey: ['reports', 'mine', input],
    queryFn: () => api.myReports({ ...input, limit: 50 }),
    enabled,
    refetchOnWindowFocus: true,
  });
}

export function useAdminReports(input: {
  status?: ReportStatus;
  targetType?: ReportTargetType;
  reason?: ReportReason;
} = {}, enabled = true) {
  return useQuery({
    queryKey: ['admin', 'reports', input],
    queryFn: () => api.adminReports({ ...input, limit: 50 }),
    enabled,
    refetchOnWindowFocus: true,
  });
}

export function useUpdateAdminReportStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reportId, status, adminNote }: { reportId: string; status: ReportStatus; adminNote?: string }) =>
      api.updateAdminReportStatus(reportId, { status, adminNote }),
    onSuccess: async () => {
      await invalidateQueryKeys(queryClient, [
        ['admin', 'reports'],
        ['admin', 'audit-logs'],
        ['notifications'],
        ['reports', 'mine'],
      ]);
    },
  });
}

export function useAdminReportAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reportId,
      action,
    }: {
      reportId: string;
      action: 'suspend-user' | 'activate-user' | 'close-job' | 'remove-review' | 'hide-message';
    }) => api.adminReportAction(reportId, action),
    onSuccess: async () => {
      await invalidateQueryKeys(queryClient, [
        ['admin', 'reports'],
        ['admin', 'users'],
        ['admin', 'jobs'],
        ['admin', 'reviews'],
        ['admin', 'conversation'],
        ['admin', 'statistics'],
        ['admin', 'audit-logs'],
      ]);
    },
  });
}
