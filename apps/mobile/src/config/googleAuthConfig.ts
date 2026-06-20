import Constants from 'expo-constants';
import { Platform } from 'react-native';

type GoogleAuthExtra = {
  googleAndroidClientId?: string;
  googleIosClientId?: string;
  googleWebClientId?: string;
};

export const googleAuthConfig = resolveGoogleAuthConfig();

function resolveGoogleAuthConfig() {
  const extra = (Constants.expoConfig?.extra ?? {}) as GoogleAuthExtra;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() || extra.googleAndroidClientId;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || extra.googleIosClientId;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || extra.googleWebClientId;

  return {
    androidClientId,
    iosClientId,
    webClientId,
    isConfigured:
      Platform.OS === 'android'
        ? Boolean(androidClientId || webClientId)
        : Platform.OS === 'ios'
          ? Boolean(iosClientId || webClientId)
          : Boolean(webClientId),
  };
}
