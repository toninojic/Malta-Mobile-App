import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PRODUCT_CATEGORY,
  PURCHASES_ERROR_CODE,
  PurchasesError,
} from 'react-native-purchases';
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

let configuredUserId: string | null = null;

export function getRevenueCatProductId(tokenPackage: TokenPackage) {
  return PRODUCT_IDS_BY_TOKEN_COUNT[tokenPackage.tokenCount];
}

export async function configureRevenueCatForCurrentUser() {
  if (Platform.OS === 'web' || !purchaseConfig.activeApiKey) {
    return false;
  }

  const user = useAuthStore.getState().user;

  if (!user?.id) {
    return false;
  }

  try {
    Purchases.setLogLevel(LOG_LEVEL.INFO);

    const isConfigured = await Purchases.isConfigured().catch(() => false);

    if (!isConfigured) {
      Purchases.configure({
        apiKey: purchaseConfig.activeApiKey,
        appUserID: user.id,
      });
      configuredUserId = user.id;
    } else if (configuredUserId !== user.id) {
      await Purchases.logIn(user.id);
      configuredUserId = user.id;
    }

    await Promise.all([
      Purchases.setEmail(user.email).catch(() => undefined),
      Purchases.setDisplayName(user.profile?.displayName ?? user.email).catch(() => undefined),
    ]);

    return true;
  } catch {
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
