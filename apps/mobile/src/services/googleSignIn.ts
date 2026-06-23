import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthSessionResult, ResponseType, makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { googleAuthConfig } from '../config/googleAuthConfig';
import { shouldLogGoogleAuthDiagnostics } from './googleAuthUi';

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
      if (shouldLogGoogleAuthDiagnostics()) {
        console.info('[google-auth] browser method', {
          platform: Platform.OS,
          method: 'providerPromptAsync',
        });
      }
      return providerPromptAsync();
    }

    if (!request?.url) {
      throw new Error('Google auth request is not ready.');
    }

    const startUrl = buildExpoProxyStartUrl(request.url, nativeReturnUrl);
    if (shouldLogGoogleAuthDiagnostics()) {
      console.info('[google-auth] browser method', {
        platform: Platform.OS,
        method: 'WebBrowser.openAuthSessionAsync',
      });
    }

    let browserResult: WebBrowser.WebBrowserAuthSessionResult;
    try {
      browserResult = await WebBrowser.openAuthSessionAsync(startUrl, nativeReturnUrl);
    } catch (error) {
      const message = errorToMessage(error);
      console.warn('[google-auth] WebBrowser error', {
        platform: Platform.OS,
        method: 'WebBrowser.openAuthSessionAsync',
        message,
      });

      if (isNoMatchingBrowserActivityError(message)) {
        throw new Error('Google sign-in could not open a browser. Please make sure Chrome or another browser is enabled.');
      }

      throw error instanceof Error ? error : new Error(message);
    }

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

    console.info('[google-auth] platform', { platform: Platform.OS });
    console.info('[google-auth] redirectUri', { redirectUri: googleAuthConfig.redirectUri });
    console.info('[google-auth] useProxy', {
      useProxy: false,
      manualExpoProxyStartUrl: Platform.OS !== 'web',
    });
    console.info('[google-auth] request config', {
      platform: Platform.OS,
      authMode: googleAuthConfig.authMode,
      generatedRedirectUri: googleAuthConfig.redirectUri,
      nativeReturnUrl,
      useProxy: false,
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

    console.info('[google-auth] auth result type', { type: response.type });
    console.info('[google-auth] has idToken', {
      hasIdToken: response.type === 'success' ? Boolean(response.params.id_token) : false,
    });
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

function errorToMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isNoMatchingBrowserActivityError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('no matching browser activity') || normalized.includes('no activity found to handle intent');
}
