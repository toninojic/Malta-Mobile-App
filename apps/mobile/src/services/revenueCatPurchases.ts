import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PRODUCT_CATEGORY,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';
import type { PurchasesError } from 'react-native-purchases';
import { purchaseConfig } from '../config/purchaseConfig';
import { useAuthStore } from '../store/auth.store';
import { TokenPackage } from '../types/domain';

const PRODUCT_IDS_BY_TOKEN_COUNT: Record<number, string> = {
  5: 'maltapro_tokens_5',
  20: 'maltapro_tokens_20',
  50: 'maltapro_tokens_50',
};

export type RevenueCatPurchaseResult = {
  productId: string;
  processing: true;
};

export type RevenueCatDiagnostics = {
  platform: string;
  buildProfile: string;
  apiKeyPresent: boolean;
  androidApiKeyPresent: boolean;
  androidApiKeyLooksLikeGoogle: boolean;
  mockPurchasesAllowed: boolean;
  appUserIdPresent: boolean;
  appUserId: string | null;
  configureCalled: boolean;
  configuredAppUserId: string | null;
  customerInfoSucceeded: boolean | null;
  customerInfoAppUserId: string | null;
  offeringsSucceeded: boolean | null;
  defaultOfferingPresent: boolean | null;
  currentOfferingIdentifier: string | null;
  offeringCount: number | null;
  lastEvent: string;
  lastError: string | null;
  updatedAt: string | null;
};

let configuredUserId: string | null = null;
let offeringsCheckedForUserId: string | null = null;
let customerInfoCheckedForUserId: string | null = null;

let revenueCatDiagnostics: RevenueCatDiagnostics = {
  platform: Platform.OS,
  buildProfile: purchaseConfig.buildProfile ?? 'unknown',
  apiKeyPresent: Boolean(purchaseConfig.activeApiKey),
  androidApiKeyPresent: Boolean(purchaseConfig.androidApiKey),
  androidApiKeyLooksLikeGoogle: purchaseConfig.androidApiKey.startsWith('goog_'),
  mockPurchasesAllowed: purchaseConfig.allowMockPurchases,
  appUserIdPresent: false,
  appUserId: null,
  configureCalled: false,
  configuredAppUserId: null,
  customerInfoSucceeded: null,
  customerInfoAppUserId: null,
  offeringsSucceeded: null,
  defaultOfferingPresent: null,
  currentOfferingIdentifier: null,
  offeringCount: null,
  lastEvent: 'not started',
  lastError: null,
  updatedAt: null,
};

const diagnosticsListeners = new Set<(diagnostics: RevenueCatDiagnostics) => void>();

export function getRevenueCatProductId(tokenPackage: TokenPackage) {
  return PRODUCT_IDS_BY_TOKEN_COUNT[tokenPackage.tokenCount];
}

export function getRevenueCatDiagnosticsSnapshot() {
  return revenueCatDiagnostics;
}

export function subscribeToRevenueCatDiagnostics(listener: (diagnostics: RevenueCatDiagnostics) => void) {
  diagnosticsListeners.add(listener);
  listener(revenueCatDiagnostics);

  return () => {
    diagnosticsListeners.delete(listener);
  };
}

export async function configureRevenueCatForCurrentUser(options: { forceDiagnostics?: boolean } = {}) {
  const user = useAuthStore.getState().user;

  logRevenueCatDebug('init requested', {
    platform: Platform.OS,
    buildProfile: purchaseConfig.buildProfile ?? 'unknown',
    apiKeyPresent: Boolean(purchaseConfig.activeApiKey),
    androidApiKeyPresent: Boolean(purchaseConfig.androidApiKey),
    androidApiKeyLooksLikeGoogle: purchaseConfig.androidApiKey.startsWith('goog_'),
    appUserIdPresent: Boolean(user?.id),
    mockPurchasesAllowed: purchaseConfig.allowMockPurchases,
  });

  updateRevenueCatDiagnostics('init requested', {
    platform: Platform.OS,
    buildProfile: purchaseConfig.buildProfile ?? 'unknown',
    apiKeyPresent: Boolean(purchaseConfig.activeApiKey),
    androidApiKeyPresent: Boolean(purchaseConfig.androidApiKey),
    androidApiKeyLooksLikeGoogle: purchaseConfig.androidApiKey.startsWith('goog_'),
    appUserIdPresent: Boolean(user?.id),
    appUserId: user?.id ?? null,
    mockPurchasesAllowed: purchaseConfig.allowMockPurchases,
    lastError: null,
  });

  if (Platform.OS === 'web') {
    logRevenueCatDebug('init skipped', { reason: 'web platform' });
    updateRevenueCatDiagnostics('init skipped', { lastError: 'web platform' });
    return false;
  }

  if (!purchaseConfig.activeApiKey) {
    logRevenueCatDebug('init skipped', { reason: 'missing RevenueCat public api key' });
    updateRevenueCatDiagnostics('init skipped', { lastError: 'missing RevenueCat public api key' });
    return false;
  }

  if (!user?.id) {
    logRevenueCatDebug('init skipped', { reason: 'missing backend user id' });
    updateRevenueCatDiagnostics('init skipped', { lastError: 'missing backend user id' });
    return false;
  }

  try {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);

    const isConfigured = await Purchases.isConfigured().catch(() => false);

    if (!isConfigured) {
      logRevenueCatDebug('Purchases.configure called', {
        appUserID: user.id,
        appUserIdPresent: true,
        apiKeyPresent: true,
      });
      updateRevenueCatDiagnostics('Purchases.configure called', {
        configureCalled: true,
        configuredAppUserId: user.id,
      });
      Purchases.configure({
        apiKey: purchaseConfig.activeApiKey,
        appUserID: user.id,
      });
      configuredUserId = user.id;
    } else if (configuredUserId !== user.id) {
      logRevenueCatDebug('Purchases.logIn called', {
        appUserID: user.id,
        appUserIdPresent: true,
      });
      updateRevenueCatDiagnostics('Purchases.logIn called', {
        configureCalled: true,
        configuredAppUserId: user.id,
      });
      await Purchases.logIn(user.id);
      configuredUserId = user.id;
    } else {
      logRevenueCatDebug('already configured for current user', {
        appUserID: user.id,
        appUserIdPresent: true,
      });
      updateRevenueCatDiagnostics('already configured for current user', {
        configureCalled: true,
        configuredAppUserId: user.id,
      });
    }

    await Promise.all([
      Purchases.setEmail(user.email).catch(() => undefined),
      Purchases.setDisplayName(user.profile?.displayName ?? user.email).catch(() => undefined),
    ]);

    await logRevenueCatCustomerInfoDiagnostics(user.id, options.forceDiagnostics);
    await logRevenueCatOfferingsDiagnostics(user.id, options.forceDiagnostics);

    return true;
  } catch (error) {
    logRevenueCatDebug('init failed', {
      message: getRevenueCatErrorMessage(error),
    });
    updateRevenueCatDiagnostics('init failed', { lastError: getRevenueCatErrorMessage(error) });
    return false;
  }
}

export async function purchaseTokenPackageWithRevenueCat(tokenPackage: TokenPackage): Promise<RevenueCatPurchaseResult> {
  const productId = getRevenueCatProductId(tokenPackage);

  if (!productId) {
    throw new Error('Purchases are not configured for this token package.');
  }

  if (!purchaseConfig.isRevenueCatConfigured) {
    throw new Error('Purchases are not configured.');
  }

  if (Platform.OS === 'web') {
    throw new Error('Native purchases require an Android or iOS development build.');
  }

  const isConfigured = await configureRevenueCatForCurrentUser();

  if (!isConfigured) {
    throw new Error('Purchases are not ready. Please sign in again and try once more.');
  }

  try {
    const products = await Purchases.getProducts([productId], PRODUCT_CATEGORY.NON_SUBSCRIPTION);
    const product = products[0];

    if (!product) {
      throw new Error(`Store product ${productId} is not available for purchase.`);
    }

    await Purchases.purchaseStoreProduct(product);

    return {
      productId,
      processing: true,
    };
  } catch (error) {
    throw new Error(getRevenueCatErrorMessage(error));
  }
}

function getRevenueCatErrorMessage(error: unknown) {
  const purchasesError = error as Partial<PurchasesError> | undefined;

  if (
    purchasesError?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ||
    purchasesError?.userCancelled === true
  ) {
    return 'Purchase cancelled.';
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (purchasesError?.message) {
    return purchasesError.message;
  }

  return 'Purchase could not be completed. Please try again.';
}

async function logRevenueCatCustomerInfoDiagnostics(userId: string, forceDiagnostics = false) {
  if (!forceDiagnostics && customerInfoCheckedForUserId === userId) {
    return;
  }

  customerInfoCheckedForUserId = userId;

  try {
    const customerInfo = await Purchases.getCustomerInfo();

    logRevenueCatDebug('getCustomerInfo result', {
      appUserID: userId,
      originalAppUserId: customerInfo.originalAppUserId,
      activeEntitlementCount: Object.keys(customerInfo.entitlements.active ?? {}).length,
    });
    updateRevenueCatDiagnostics('getCustomerInfo result', {
      customerInfoSucceeded: true,
      customerInfoAppUserId: customerInfo.originalAppUserId ?? userId,
      lastError: null,
    });
  } catch (error) {
    logRevenueCatDebug('getCustomerInfo error', {
      appUserID: userId,
      message: getRevenueCatErrorMessage(error),
    });
    updateRevenueCatDiagnostics('getCustomerInfo error', {
      customerInfoSucceeded: false,
      lastError: getRevenueCatErrorMessage(error),
    });
  }
}

async function logRevenueCatOfferingsDiagnostics(userId: string, forceDiagnostics = false) {
  if (!forceDiagnostics && offeringsCheckedForUserId === userId) {
    return;
  }

  offeringsCheckedForUserId = userId;

  try {
    const offerings = await Purchases.getOfferings();
    const allOfferings = Object.keys(offerings.all ?? {});
    const currentIdentifier = offerings.current?.identifier ?? null;
    const defaultOfferingPresent = Boolean((offerings.all ?? {}).default ?? offerings.current);

    logRevenueCatDebug('getOfferings result', {
      appUserID: userId,
      currentOfferingPresent: Boolean(offerings.current),
      currentOfferingIdentifier: currentIdentifier,
      defaultOfferingPresent,
      offeringCount: allOfferings.length,
    });
    updateRevenueCatDiagnostics('getOfferings result', {
      offeringsSucceeded: true,
      defaultOfferingPresent,
      currentOfferingIdentifier: currentIdentifier,
      offeringCount: allOfferings.length,
      lastError: null,
    });
  } catch (error) {
    logRevenueCatDebug('getOfferings error', {
      appUserID: userId,
      message: getRevenueCatErrorMessage(error),
    });
    updateRevenueCatDiagnostics('getOfferings error', {
      offeringsSucceeded: false,
      defaultOfferingPresent: false,
      currentOfferingIdentifier: null,
      offeringCount: null,
      lastError: getRevenueCatErrorMessage(error),
    });
  }
}

function logRevenueCatDebug(message: string, details: Record<string, unknown> = {}) {
  console.log('[RevenueCat]', message, details);
}

function updateRevenueCatDiagnostics(event: string, partial: Partial<RevenueCatDiagnostics>) {
  revenueCatDiagnostics = {
    ...revenueCatDiagnostics,
    ...partial,
    lastEvent: event,
    updatedAt: new Date().toISOString(),
  };

  console.log('[RevenueCat][diagnostics]', {
    event,
    apiKeyPresent: revenueCatDiagnostics.apiKeyPresent,
    androidApiKeyPresent: revenueCatDiagnostics.androidApiKeyPresent,
    androidApiKeyLooksLikeGoogle: revenueCatDiagnostics.androidApiKeyLooksLikeGoogle,
    mockPurchasesAllowed: revenueCatDiagnostics.mockPurchasesAllowed,
    appUserIdPresent: revenueCatDiagnostics.appUserIdPresent,
    appUserID: revenueCatDiagnostics.appUserId,
    configureCalled: revenueCatDiagnostics.configureCalled,
    configuredAppUserID: revenueCatDiagnostics.configuredAppUserId,
    customerInfoSucceeded: revenueCatDiagnostics.customerInfoSucceeded,
    customerInfoAppUserID: revenueCatDiagnostics.customerInfoAppUserId,
    offeringsSucceeded: revenueCatDiagnostics.offeringsSucceeded,
    defaultOfferingPresent: revenueCatDiagnostics.defaultOfferingPresent,
    currentOfferingIdentifier: revenueCatDiagnostics.currentOfferingIdentifier,
    offeringCount: revenueCatDiagnostics.offeringCount,
    lastError: revenueCatDiagnostics.lastError,
  });

  diagnosticsListeners.forEach((listener) => listener(revenueCatDiagnostics));
}
