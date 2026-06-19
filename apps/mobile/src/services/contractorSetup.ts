import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type ContractorSetupStatus = 'required' | 'completed' | 'skipped' | 'error';
export type ContractorSetupCompletion = 'completed' | 'skipped';

type ContractorSetupDecision = {
  isNewlyRegisteredContractor: boolean;
  contractorOnboardingRequired: boolean;
  contractorOnboardingCompleted: boolean;
  contractorOnboardingSkipped: boolean;
  finalNavigationTarget: 'contractor-setup' | 'app';
};

const COMPLETED_KEY_PREFIX = 'malta_contractor_setup_completed';
const SKIPPED_KEY_PREFIX = 'malta_contractor_setup_skipped';
const REQUIRED_KEY_PREFIX = 'malta_contractor_setup_required';
const memoryStorage = new Map<string, string>();
let newlyRegisteredContractorId: string | null = null;
const sessionOutcomes = new Map<string, ContractorSetupCompletion>();

export function getContractorSetupDecision(user?: { id: string; role: string } | null): ContractorSetupDecision {
  const isContractor = user?.role === 'CONTRACTOR';
  const isNewlyRegisteredContractor = Boolean(isContractor && user?.id && newlyRegisteredContractorId === user.id);
  const contractorOnboardingRequired = isNewlyRegisteredContractor;
  const sessionOutcome = user?.id ? sessionOutcomes.get(user.id) : undefined;

  return {
    isNewlyRegisteredContractor,
    contractorOnboardingRequired,
    contractorOnboardingCompleted: sessionOutcome === 'completed',
    contractorOnboardingSkipped: sessionOutcome === 'skipped' || !contractorOnboardingRequired,
    finalNavigationTarget: contractorOnboardingRequired ? 'contractor-setup' : 'app',
  };
}

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
  newlyRegisteredContractorId = userId;

  try {
    const completed = await getStorageItem(completedKey(userId));
    const skipped = await getStorageItem(skippedKey(userId));
    if (completed === 'true' || skipped === 'true') {
      await deleteStorageItem(requiredKey(userId));
      newlyRegisteredContractorId = null;
      sessionOutcomes.set(userId, completed === 'true' ? 'completed' : 'skipped');
      console.info('[contractor-setup] existing persisted decision found; setup not required', {
        userId,
        contractorOnboardingCompleted: completed === 'true',
        contractorOnboardingSkipped: skipped === 'true',
        finalNavigationTarget: 'app',
      });
      return;
    }

    await setStorageItem(requiredKey(userId), 'true');
    console.info('[contractor-setup] marked required for new registration', {
      userId,
      isNewlyRegisteredContractor: true,
      contractorOnboardingRequired: true,
      finalNavigationTarget: 'contractor-setup',
    });
  } catch (error) {
    console.warn('[contractor-setup] could not mark required', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function finishContractorSetup(userId: string, outcome: ContractorSetupCompletion) {
  if (newlyRegisteredContractorId === userId) {
    newlyRegisteredContractorId = null;
  }
  sessionOutcomes.set(userId, outcome);

  try {
    await Promise.all([
      outcome === 'completed' ? setStorageItem(completedKey(userId), 'true') : deleteStorageItem(completedKey(userId)),
      outcome === 'skipped' ? setStorageItem(skippedKey(userId), 'true') : deleteStorageItem(skippedKey(userId)),
      deleteStorageItem(requiredKey(userId)),
    ]);
    console.info('[contractor-setup] finished', {
      userId,
      outcome,
      contractorOnboardingCompleted: outcome === 'completed',
      contractorOnboardingSkipped: outcome === 'skipped',
      finalNavigationTarget: 'app',
    });
  } catch (error) {
    console.warn('[contractor-setup] could not persist finished state', {
      userId,
      outcome,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function clearContractorSetupRequirement(userId: string) {
  if (newlyRegisteredContractorId === userId) {
    newlyRegisteredContractorId = null;
  }
}

function completedKey(userId: string) {
  return `${COMPLETED_KEY_PREFIX}:${userId}`;
}

function skippedKey(userId: string) {
  return `${SKIPPED_KEY_PREFIX}:${userId}`;
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
