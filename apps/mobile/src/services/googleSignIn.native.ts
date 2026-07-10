import Constants from 'expo-constants';
import type { AuthSessionResult } from 'expo-auth-session';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { googleAuthConfig } from '../config/googleAuthConfig';
import { shouldLogGoogleAuthDiagnostics } from './googleAuthUi';

type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin');

let nativeModulePromise: Promise<GoogleSignInModule> | null = null;
let configuredWebClientId: string | null = null;

export function useGoogleIdTokenRequest() {
  const [response, setResponse] = useState<AuthSessionResult | null>(null);
  const request = useMemo(
    () => (googleAuthConfig.isConfigured ? { url: 'native-google-signin://ready' } : null),
    [],
  );

  useEffect(() => {
    if (!googleAuthConfig.isConfigured || isExpoGo()) {
      return;
    }

    void prepareNativeGoogleSignIn().catch((error) => {
      logNativeEvent('configuration failed', {
        code: nativeErrorCode(error),
        message: errorToMessage(error),
      });
    });
  }, []);

  const promptGoogleAsync = useCallback(async (): Promise<AuthSessionResult> => {
    if (isExpoGo()) {
      throw new Error('Google Sign-In requires an installed EAS build and is not available in Expo Go.');
    }

    if (!googleAuthConfig.isConfigured) {
      throw new Error('Google Sign-In client IDs are missing from this build.');
    }

    setResponse(null);

    try {
      const google = await prepareNativeGoogleSignIn();
      logNativeEvent('signIn started', {
        method: 'GoogleSignin.signIn',
        hasAndroidClientId: Boolean(googleAuthConfig.androidClientId),
        hasWebClientId: Boolean(googleAuthConfig.webClientId),
      });

      if (Platform.OS === 'android') {
        await google.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      const signInResponse = await google.GoogleSignin.signIn();
      if (!google.isSuccessResponse(signInResponse)) {
        const cancelled: AuthSessionResult = { type: 'cancel' };
        setResponse(cancelled);
        logNativeEvent('signIn result', { type: signInResponse.type, hasIdToken: false });
        return cancelled;
      }

      const idToken = signInResponse.data.idToken;
      if (!idToken) {
        throw new Error(
          'Google did not return an ID token. Verify that EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is a Web OAuth client ID.',
        );
      }

      const success: AuthSessionResult = {
        type: 'success',
        errorCode: null,
        params: { id_token: idToken },
        authentication: null,
        url: 'native-google-signin://success',
      };
      setResponse(success);
      logNativeEvent('signIn result', { type: 'success', hasIdToken: true });
      return success;
    } catch (error) {
      const code = nativeErrorCode(error);
      const message = errorToMessage(error);
      console.warn('[google-auth] native signIn failed', {
        platform: Platform.OS,
        code,
        message,
      });
      throw new Error(friendlyNativeGoogleError(code, message));
    }
  }, []);

  useEffect(() => {
    if (!shouldLogGoogleAuthDiagnostics()) {
      return;
    }

    console.info('[google-auth] platform', { platform: Platform.OS });
    console.info('[google-auth] redirectUri', { redirectUri: null });
    console.info('[google-auth] useProxy', { useProxy: false });
    console.info('[google-auth] request config', {
      authMode: googleAuthConfig.authMode,
      browserMethod: 'none',
      nativeMethod: 'GoogleSignin.signIn',
      expoGo: isExpoGo(),
      hasAndroidClientId: Boolean(googleAuthConfig.androidClientId),
      hasWebClientId: Boolean(googleAuthConfig.webClientId),
      hasIosClientId: Boolean(googleAuthConfig.iosClientId),
    });
  }, []);

  return [request, response, promptGoogleAsync] as const;
}

export function googleAuthIsConfigured() {
  return googleAuthConfig.isConfigured;
}

export async function signOutGoogleSession() {
  if (isExpoGo() || !googleAuthConfig.webClientId) {
    return;
  }

  try {
    const google = await prepareNativeGoogleSignIn();
    await google.GoogleSignin.signOut();
    logNativeEvent('signed out', { method: 'GoogleSignin.signOut' });
  } catch (error) {
    logNativeEvent('signOut failed', {
      code: nativeErrorCode(error),
      message: errorToMessage(error),
    });
  }
}

async function prepareNativeGoogleSignIn() {
  const webClientId = googleAuthConfig.webClientId;
  if (!webClientId) {
    throw new Error('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is missing.');
  }

  const google = await loadNativeModule();
  if (configuredWebClientId !== webClientId) {
    google.GoogleSignin.configure({
      webClientId,
      iosClientId: googleAuthConfig.iosClientId,
      offlineAccess: false,
      forceCodeForRefreshToken: false,
    });
    configuredWebClientId = webClientId;
    logNativeEvent('configured', {
      method: 'GoogleSignin.configure',
      hasWebClientId: true,
      hasIosClientId: Boolean(googleAuthConfig.iosClientId),
    });
  }

  return google;
}

function loadNativeModule() {
  nativeModulePromise ??= import('@react-native-google-signin/google-signin').catch((error) => {
    nativeModulePromise = null;
    throw new Error(
      `Native Google Sign-In is not included in this app build. Install the latest EAS build. ${errorToMessage(error)}`,
    );
  });
  return nativeModulePromise;
}

function isExpoGo() {
  return Constants.appOwnership === 'expo';
}

function nativeErrorCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return null;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' || typeof code === 'number' ? String(code) : null;
}

function friendlyNativeGoogleError(code: string | null, message: string) {
  const normalized = `${code ?? ''} ${message}`.toLowerCase();

  if (normalized.includes('in_progress')) {
    return 'Google Sign-In is already open. Please complete or cancel the current sign-in first.';
  }
  if (normalized.includes('play_services_not_available')) {
    return 'Google Play Services are unavailable or out of date on this device.';
  }
  if (normalized.includes('developer_error') || code === '10') {
    return (
      'Google Sign-In configuration does not match this Android build. Verify package mt.marketplace.craftsman, ' +
      'the Google Play App Signing SHA-1, and the Web OAuth client ID.'
    );
  }
  if (normalized.includes('network_error') || normalized.includes('network')) {
    return 'Google Sign-In could not reach Google. Check the connection and try again.';
  }
  if (normalized.includes('native google sign-in is not included')) {
    return 'This installed MaltaPro build is outdated. Install a new EAS build that includes Google Sign-In.';
  }

  return message || 'Google Sign-In failed. Please try again.';
}

function logNativeEvent(event: string, payload: Record<string, unknown>) {
  if (!shouldLogGoogleAuthDiagnostics()) {
    return;
  }

  console.info('[google-auth] native', {
    platform: Platform.OS,
    event,
    ...payload,
  });
}

function errorToMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
