import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { AuthResponse, AuthUser } from '../types/domain';

const ACCESS_TOKEN_KEY = 'malta_access_token';
const REFRESH_TOKEN_KEY = 'malta_refresh_token';
const USER_KEY = 'malta_user';

const memoryStorage = new Map<string, string>();

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

async function deleteStorageItem(key: string) {
  if (Platform.OS === 'web') {
    getWebStorage()?.removeItem(key);
    memoryStorage.delete(key);
    return;
  }

  return SecureStore.deleteItemAsync(key);
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

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (session: AuthResponse) => Promise<void>;
  updateUser: (user: AuthUser) => Promise<void>;
  clearSession: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  hydrated: false,
  hydrate: async () => {
    const [accessToken, refreshToken, userJson] = await Promise.all([
      getStorageItem(ACCESS_TOKEN_KEY),
      getStorageItem(REFRESH_TOKEN_KEY),
      getStorageItem(USER_KEY),
    ]);

    set({
      accessToken,
      refreshToken,
      user: userJson ? (JSON.parse(userJson) as AuthUser) : null,
      hydrated: true,
    });
  },
  setSession: async (session) => {
    await Promise.all([
      setStorageItem(ACCESS_TOKEN_KEY, session.accessToken),
      setStorageItem(REFRESH_TOKEN_KEY, session.refreshToken),
      setStorageItem(USER_KEY, JSON.stringify(session.user)),
    ]);

    set({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: session.user,
    });
  },
  updateUser: async (user) => {
    await setStorageItem(USER_KEY, JSON.stringify(user));
    set({ user });
  },
  clearSession: async () => {
    await Promise.all([
      deleteStorageItem(ACCESS_TOKEN_KEY),
      deleteStorageItem(REFRESH_TOKEN_KEY),
      deleteStorageItem(USER_KEY),
    ]);
    set({ accessToken: null, refreshToken: null, user: null });
  },
}));

export function getAccessToken() {
  return useAuthStore.getState().accessToken;
}

export function getRefreshToken() {
  return useAuthStore.getState().refreshToken;
}

export function hasEmployerTools() {
  const role = useAuthStore.getState().user?.role;
  return role === 'EMPLOYER' || role === 'ADMIN';
}
