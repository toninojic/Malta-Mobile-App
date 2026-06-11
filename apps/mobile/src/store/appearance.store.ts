import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';

export type AppearanceMode = 'system' | 'light' | 'dark';

const APPEARANCE_KEY = 'malta_appearance_mode';
const memoryStorage = new Map<string, string>();

type AppearanceState = {
  mode: AppearanceMode;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setMode: (mode: AppearanceMode) => Promise<void>;
};

export const useAppearanceStore = create<AppearanceState>((set) => ({
  mode: 'system',
  hydrated: false,
  hydrate: async () => {
    const stored = await getStorageItem(APPEARANCE_KEY);
    set({
      mode: isAppearanceMode(stored) ? stored : 'system',
      hydrated: true,
    });
  },
  setMode: async (mode) => {
    await setStorageItem(APPEARANCE_KEY, mode);
    set({ mode });
  },
}));

async function getStorageItem(key: string) {
  if (Platform.OS === 'web') {
    return getWebStorage()?.getItem(key) ?? memoryStorage.get(key) ?? null;
  }

  return SecureStore.getItemAsync(key);
}

async function setStorageItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    const storage = getWebStorage();
    if (storage) {
      storage.setItem(key, value);
      return;
    }

    memoryStorage.set(key, value);
    return;
  }

  return SecureStore.setItemAsync(key, value);
}

function getWebStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isAppearanceMode(value: string | null): value is AppearanceMode {
  return value === 'system' || value === 'light' || value === 'dark';
}
