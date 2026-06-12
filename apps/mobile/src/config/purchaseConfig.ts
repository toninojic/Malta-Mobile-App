import Constants from 'expo-constants';
import { Platform } from 'react-native';

type ExpoExtra = {
  revenueCatApiKeyAndroid?: string;
  revenueCatApiKeyIos?: string;
  allowMockPurchases?: boolean;
};

function parseBooleanEnv(value: string | undefined) {
  return ['true', '1', 'yes', 'on'].includes(String(value ?? '').trim().replace(/^['"]|['"]$/g, '').toLowerCase());
}

function getExpoExtra() {
  return (Constants.expoConfig?.extra ?? {}) as ExpoExtra;
}

const extra = getExpoExtra();
const androidApiKey =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID?.trim() || extra.revenueCatApiKeyAndroid?.trim() || '';
const iosApiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS?.trim() || extra.revenueCatApiKeyIos?.trim() || '';
const activeApiKey = Platform.OS === 'ios' ? iosApiKey : androidApiKey;

export const purchaseConfig = {
  allowMockPurchases:
    parseBooleanEnv(process.env.EXPO_PUBLIC_ALLOW_MOCK_PURCHASES) || extra.allowMockPurchases === true,
  androidApiKey,
  iosApiKey,
  activeApiKey,
  isRevenueCatConfigured: Boolean(activeApiKey),
  platform: Platform.OS,
};
