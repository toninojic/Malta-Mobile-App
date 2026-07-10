import { ResponseType, makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { googleAuthConfig } from '../config/googleAuthConfig';
import { shouldLogGoogleAuthDiagnostics } from './googleAuthUi';

// This file is used by Expo web. Android and iOS resolve googleSignIn.native.ts.
WebBrowser.maybeCompleteAuthSession();

export function useGoogleIdTokenRequest() {
  const redirectUri = useMemo(
    () =>
      makeRedirectUri({
        path: googleAuthConfig.redirectPath,
        preferLocalhost: true,
      }),
    [],
  );
  const [request, response, promptGoogleAsync] = Google.useAuthRequest({
    clientId: googleAuthConfig.webClientId ?? 'missing-google-web-client-id',
    webClientId: googleAuthConfig.webClientId,
    redirectUri,
    responseType: ResponseType.IdToken,
    scopes: googleAuthConfig.scopes,
    selectAccount: true,
  });

  useEffect(() => {
    if (!shouldLogGoogleAuthDiagnostics()) {
      return;
    }

    console.info('[google-auth] platform', { platform: Platform.OS });
    console.info('[google-auth] redirectUri', { redirectUri });
    console.info('[google-auth] useProxy', { useProxy: false });
    console.info('[google-auth] request config', {
      authMode: googleAuthConfig.authMode,
      hasWebClientId: Boolean(googleAuthConfig.webClientId),
      requestReady: Boolean(request?.url),
    });
  }, [redirectUri, request?.url]);

  useEffect(() => {
    if (!shouldLogGoogleAuthDiagnostics() || !response) {
      return;
    }

    console.info('[google-auth] auth result type', { type: response.type });
    console.info('[google-auth] has idToken', {
      hasIdToken: response.type === 'success' ? Boolean(response.params.id_token) : false,
    });
  }, [response]);

  return [request, response, promptGoogleAsync] as const;
}

export function googleAuthIsConfigured() {
  return googleAuthConfig.isConfigured;
}

export async function signOutGoogleSession() {
  // Expo web AuthSession does not retain a native Google SDK session.
}
