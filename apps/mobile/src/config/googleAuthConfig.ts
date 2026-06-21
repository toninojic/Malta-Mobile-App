import * as AuthSession from 'expo-auth-session';
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

function resolveGoogleAuthConfig() {
  const extra = (Constants.expoConfig?.extra ?? {}) as GoogleAuthExtra;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() || extra.googleAndroidClientId;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || extra.googleIosClientId;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || extra.googleWebClientId;
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: googleAuthScheme,
    path: googleAuthRedirectPath,
    native: `${googleAuthScheme}://${googleAuthRedirectPath}`,
  });

  return {
    androidClientId,
    iosClientId,
    redirectPath: googleAuthRedirectPath,
    redirectUri,
    scheme: googleAuthScheme,
    scopes: googleAuthScopes,
    webClientId,
    isConfigured:
      Platform.OS === 'android'
        ? Boolean(androidClientId)
        : Platform.OS === 'ios'
          ? Boolean(iosClientId)
          : Boolean(webClientId),
  };
}
