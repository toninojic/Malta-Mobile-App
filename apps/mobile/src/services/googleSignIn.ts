import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthSessionResult, ResponseType, makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { googleAuthConfig } from '../config/googleAuthConfig';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleIdTokenRequest() {
  const [request, providerResponse, providerPromptAsync] = Google.useAuthRequest({
    clientId: googleAuthConfig.webClientId,
    redirectUri: googleAuthConfig.redirectUri,
    responseType: ResponseType.IdToken,
    scopes: googleAuthConfig.scopes,
    selectAccount: true,
    webClientId: googleAuthConfig.webClientId,
  });
  const [proxyResponse, setProxyResponse] = useState<AuthSessionResult | null>(null);
  const nativeReturnUrl = useMemo(
    () =>
      makeRedirectUri({
        scheme: googleAuthConfig.scheme,
        path: googleAuthConfig.redirectPath,
        native: `${googleAuthConfig.scheme}://${googleAuthConfig.redirectPath}`,
      }),
    [],
  );
  const response = Platform.OS === 'web' ? providerResponse : proxyResponse;
  const promptGoogleAsync = useCallback(async () => {
    if (Platform.OS === 'web') {
      return providerPromptAsync();
    }

    if (!request?.url) {
      throw new Error('Google auth request is not ready.');
    }

    const startUrl = buildExpoProxyStartUrl(request.url, nativeReturnUrl);
    const browserResult = await WebBrowser.openAuthSessionAsync(startUrl, nativeReturnUrl);
    const result =
      browserResult.type === 'success'
        ? request.parseReturnUrl(browserResult.url)
        : ({ type: browserResult.type } as AuthSessionResult);

    setProxyResponse(result);
    return result;
  }, [nativeReturnUrl, providerPromptAsync, request]);

  useEffect(() => {
    if (!shouldLogGoogleAuthDiagnostics()) {
      return;
    }

    console.info('[google-auth] request config', {
      platform: Platform.OS,
      authMode: googleAuthConfig.authMode,
      generatedRedirectUri: googleAuthConfig.redirectUri,
      nativeReturnUrl,
      scheme: googleAuthConfig.scheme,
      proxyEnabled: Platform.OS !== 'web',
      hasAndroidClientId: Boolean(googleAuthConfig.androidClientId),
      hasWebClientId: Boolean(googleAuthConfig.webClientId),
      hasIosClientId: Boolean(googleAuthConfig.iosClientId),
      usesExpoProxy: Platform.OS !== 'web',
    });
  }, [nativeReturnUrl]);

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

  return [request, response, promptGoogleAsync] as const;
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

function buildExpoProxyStartUrl(authUrl: string, returnUrl: string) {
  const query = `authUrl=${encodeURIComponent(authUrl)}&returnUrl=${encodeURIComponent(returnUrl)}`;
  return `${googleAuthConfig.redirectUri}/start?${query}`;
}
