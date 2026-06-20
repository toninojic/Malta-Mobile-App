import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { googleAuthConfig } from '../config/googleAuthConfig';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleIdTokenRequest() {
  return Google.useIdTokenAuthRequest({
    androidClientId: googleAuthConfig.androidClientId,
    iosClientId: googleAuthConfig.iosClientId,
    webClientId: googleAuthConfig.webClientId,
  });
}

export function googleAuthIsConfigured() {
  return googleAuthConfig.isConfigured;
}
