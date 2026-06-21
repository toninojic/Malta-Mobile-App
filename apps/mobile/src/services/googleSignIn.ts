import { useEffect } from 'react';
import { ResponseType } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { googleAuthConfig } from '../config/googleAuthConfig';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleIdTokenRequest() {
  const requestState = Google.useAuthRequest({
    clientId: googleAuthConfig.webClientId,
    redirectUri: googleAuthConfig.redirectUri,
    responseType: ResponseType.IdToken,
    scopes: googleAuthConfig.scopes,
    selectAccount: true,
    webClientId: googleAuthConfig.webClientId,
  });
  const [request, response] = requestState;

  useEffect(() => {
    if (!shouldLogGoogleAuthDiagnostics()) {
      return;
    }

    console.info('[google-auth] request config', {
      platform: Platform.OS,
      authMode: googleAuthConfig.authMode,
      redirectUri: googleAuthConfig.redirectUri,
      scheme: googleAuthConfig.scheme,
      useProxy: true,
      projectFullNameForProxy: googleAuthConfig.projectFullNameForProxy,
      hasAndroidClientId: Boolean(googleAuthConfig.androidClientId),
      hasWebClientId: Boolean(googleAuthConfig.webClientId),
      hasIosClientId: Boolean(googleAuthConfig.iosClientId),
      usesExpoProxy: true,
    });
  }, []);

  useEffect(() => {
    if (!shouldLogGoogleAuthDiagnostics() || !request) {
      return;
    }

    console.info('[google-auth] auth request config', {
      platform: Platform.OS,
      clientId: maskClientId(request.clientId),
      redirectUri: request.redirectUri,
      responseType: request.responseType,
      scopes: request.scopes,
      prompt: request.prompt,
      usePKCE: request.usePKCE,
      hasCodeChallenge: Boolean(request.codeChallenge),
      extraParamKeys: Object.keys(request.extraParams ?? {}),
    });
  }, [request]);

  useEffect(() => {
    if (!shouldLogGoogleAuthDiagnostics() || !response) {
      return;
    }

    console.info('[google-auth] response', {
      type: response.type,
      requestLoaded: Boolean(request),
      idTokenReturned: response.type === 'success' ? Boolean(response.params.id_token) : false,
      errorCode: response.type === 'error' ? response.errorCode : null,
      errorMessage: response.type === 'error' ? response.error?.message ?? response.params.error_description ?? response.params.error : null,
    });
  }, [request, response]);

  return requestState;
}

export function googleAuthIsConfigured() {
  return googleAuthConfig.isConfigured;
}

function shouldLogGoogleAuthDiagnostics() {
  return __DEV__ || process.env.EXPO_PUBLIC_AUTH_DEBUG === 'true';
}

function maskClientId(value?: string) {
  if (!value) {
    return null;
  }

  const [prefix, domain] = value.split('.');
  return `${(prefix ?? value).slice(0, 8)}...${domain ? `.${domain}` : ''}`;
}
