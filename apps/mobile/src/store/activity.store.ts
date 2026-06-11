import { create } from 'zustand';

type ContractorActivitySection = 'offers' | 'reviews';

type ActivityUiState = {
  viewedContractorActionCounts: Record<string, number>;
  viewedReviewTaskCounts: Record<string, number>;
  viewedContractorSectionNotificationIds: Record<string, Partial<Record<ContractorActivitySection, string[]>>>;
  markContractorActivityViewed: (userId: string, actionableCount: number) => void;
  markReviewTasksViewed: (userId: string, taskCount: number) => void;
  markContractorActivitySectionViewed: (
    userId: string,
    section: ContractorActivitySection,
    notificationIds: string[],
  ) => void;
};

export const useActivityUiStore = create<ActivityUiState>((set) => ({
  viewedContractorActionCounts: {},
  viewedReviewTaskCounts: {},
  viewedContractorSectionNotificationIds: {},
  markContractorActivityViewed: (userId, actionableCount) =>
    set((state) => ({
      viewedContractorActionCounts: {
        ...state.viewedContractorActionCounts,
        [userId]: actionableCount,
      },
    })),
  markReviewTasksViewed: (userId, taskCount) =>
    set((state) => ({
      viewedReviewTaskCounts: {
        ...state.viewedReviewTaskCounts,
        [userId]: taskCount,
      },
    })),
  markContractorActivitySectionViewed: (userId, section, notificationIds) =>
    set((state) => ({
      viewedContractorSectionNotificationIds: {
        ...state.viewedContractorSectionNotificationIds,
        [userId]: {
          ...state.viewedContractorSectionNotificationIds[userId],
          [section]: Array.from(
            new Set([
              ...(state.viewedContractorSectionNotificationIds[userId]?.[section] ?? []),
              ...notificationIds,
            ]),
          ),
        },
      },
    })),
}));
