import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type ContractorSetupStatus = 'required' | 'completed' | 'skipped' | 'error';

const COMPLETED_KEY_PREFIX = 'malta_contractor_setup_completed';
const REQUIRED_KEY_PREFIX = 'malta_contractor_setup_required';
const memoryStorage = new Map<string, string>();

export async function getContractorSetupStatus(userId: string): Promise<ContractorSetupStatus> {
  try {
    const [completed, required] = await Promise.all([
      getStorageItem(completedKey(userId)),
      getStorageItem(requiredKey(userId)),
    ]);

    if (completed === 'true') {
      return 'completed';
    }

    if (required === 'true') {
      return 'required';
    }

    return 'skipped';
  } catch (error) {
    console.warn('[contractor-setup] status load failed', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return 'error';
  }
}

export async function markContractorSetupRequired(userId: string) {
  try {
    const completed = await getStorageItem(completedKey(userId));
    if (completed === 'true') {
      return;
    }

    await setStorageItem(requiredKey(userId), 'true');
    console.info('[contractor-setup] marked required', { userId });
  } catch (error) {
    console.warn('[contractor-setup] could not mark required', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function markContractorSetupCompleted(userId: string) {
  try {
    await Promise.all([
      setStorageItem(completedKey(userId), 'true'),
      deleteStorageItem(requiredKey(userId)),
    ]);
    console.info('[contractor-setup] marked completed', { userId });
  } catch (error) {
    console.warn('[contractor-setup] could not mark completed', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function completedKey(userId: string) {
  return `${COMPLETED_KEY_PREFIX}:${userId}`;
}

function requiredKey(userId: string) {
  return `${REQUIRED_KEY_PREFIX}:${userId}`;
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
