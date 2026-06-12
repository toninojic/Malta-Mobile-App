import { Platform } from 'react-native';
import { purchaseConfig } from '../config/purchaseConfig';
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

export function getRevenueCatProductId(tokenPackage: TokenPackage) {
  return PRODUCT_IDS_BY_TOKEN_COUNT[tokenPackage.tokenCount];
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

  throw new Error(
    'RevenueCat native purchases require a development build with the RevenueCat SDK installed. Use mock purchases in Expo Go.',
  );
}
