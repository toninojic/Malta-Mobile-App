import Constants from 'expo-constants';
import { Platform } from 'react-native';

type GoogleAuthExtra = {
  googleAndroidClientId?: string;
  googleIosClientId?: string;
  googleWebClientId?: string;
};

export const googleAuthConfig = resolveGoogleAuthConfig();

const googleAuthScheme = 'maltapro';
const googleAuthRedirectPath = 'redirect';
const googleAuthScopes = ['openid', 'email', 'profile'];
const googleAuthProxyProjectFullName = '@toninojic/malta-craftsman-marketplace';
const googleAuthProxyRedirectUri = `https://auth.expo.io/${googleAuthProxyProjectFullName}`;

function resolveGoogleAuthConfig() {
  const extra = (Constants.expoConfig?.extra ?? {}) as GoogleAuthExtra;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() || extra.googleAndroidClientId;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || extra.googleIosClientId;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || extra.googleWebClientId;

  return {
    androidClientId,
    authMode: 'expo-proxy-id-token' as const,
    iosClientId,
    projectFullNameForProxy: googleAuthProxyProjectFullName,
    redirectPath: googleAuthRedirectPath,
    redirectUri: googleAuthProxyRedirectUri,
    scheme: googleAuthScheme,
    scopes: googleAuthScopes,
    webClientId,
    isConfigured:
      Platform.OS === 'android'
        ? Boolean(webClientId)
        : Platform.OS === 'ios'
          ? Boolean(webClientId)
          : Boolean(webClientId),
  };
}
