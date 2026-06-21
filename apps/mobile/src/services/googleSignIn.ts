import { useEffect } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { googleAuthConfig } from '../config/googleAuthConfig';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleIdTokenRequest() {
  const requestState = Google.useIdTokenAuthRequest({
    androidClientId: googleAuthConfig.androidClientId,
    iosClientId: Platform.OS === 'ios' ? googleAuthConfig.iosClientId : undefined,
    redirectUri: googleAuthConfig.redirectUri,
    scopes: googleAuthConfig.scopes,
    selectAccount: true,
    webClientId: googleAuthConfig.webClientId,
  });
  const [request, response] = requestState;

  useEffect(() => {
    if (!__DEV__) {
      return;
    }

    console.info('[google-auth] request config', {
      platform: Platform.OS,
      redirectUri: googleAuthConfig.redirectUri,
      scheme: googleAuthConfig.scheme,
      hasAndroidClientId: Boolean(googleAuthConfig.androidClientId),
      hasWebClientId: Boolean(googleAuthConfig.webClientId),
      hasIosClientId: Boolean(googleAuthConfig.iosClientId),
      usesExpoProxy: false,
    });
  }, []);

  useEffect(() => {
    if (!__DEV__ || !response) {
      return;
    }

    console.info('[google-auth] response', {
      type: response.type,
      requestLoaded: Boolean(request),
      idTokenReturned: response.type === 'success' ? Boolean(response.params.id_token) : false,
    });
  }, [request, response]);

  return requestState;
}

export function googleAuthIsConfigured() {
  return googleAuthConfig.isConfigured;
}
