import { create } from 'zustand';

type ActivityUiState = {
  viewedContractorActionCounts: Record<string, number>;
  markContractorActivityViewed: (userId: string, actionableCount: number) => void;
};

export const useActivityUiStore = create<ActivityUiState>((set) => ({
  viewedContractorActionCounts: {},
  markContractorActivityViewed: (userId, actionableCount) =>
    set((state) => ({
      viewedContractorActionCounts: {
        ...state.viewedContractorActionCounts,
        [userId]: actionableCount,
      },
    })),
}));
