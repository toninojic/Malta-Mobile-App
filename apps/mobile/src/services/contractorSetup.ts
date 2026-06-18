import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY_PREFIX = 'malta_contractor_setup_completed';
const memoryStorage = new Map<string, string>();

export async function isContractorSetupCompleted(userId: string) {
  const value = await getStorageItem(storageKey(userId));
  return value === 'true';
}

export async function markContractorSetupCompleted(userId: string) {
  await setStorageItem(storageKey(userId), 'true');
}

function storageKey(userId: string) {
  return `${KEY_PREFIX}:${userId}`;
}

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
