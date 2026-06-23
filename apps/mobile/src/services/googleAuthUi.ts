import type { AuthSessionResult } from 'expo-auth-session';
import { googleAuthConfig } from '../config/googleAuthConfig';
import { UserRole } from '../types/domain';

type GoogleAuthScreen = 'Login' | 'Register';

type ButtonDiagnosticsInput = {
  screen: GoogleAuthScreen;
  role?: Exclude<UserRole, 'ADMIN'>;
  termsAccepted?: boolean;
  termsRequired?: boolean;
  requestReady: boolean;
  promptAsyncExists: boolean;
};

type StartBlockInput = {
  termsAccepted?: boolean;
  termsRequired?: boolean;
  requestReady: boolean;
  promptAsyncExists: boolean;
};

export function shouldLogGoogleAuthDiagnostics() {
  return __DEV__ || process.env.EXPO_PUBLIC_AUTH_DEBUG === 'true';
}

export function logGoogleButtonDiagnostics(input: ButtonDiagnosticsInput) {
  if (!shouldLogGoogleAuthDiagnostics()) {
    return;
  }

  console.info('[google-button] pressed', { screen: input.screen });
  console.info('[google-button] role selected', {
    screen: input.screen,
    roleSelected: input.role ? true : 'not-required',
    role: input.role ?? null,
  });
  console.info('[google-button] terms accepted', {
    screen: input.screen,
    termsRequired: Boolean(input.termsRequired),
    termsAccepted: input.termsRequired ? Boolean(input.termsAccepted) : 'not-required',
  });
  console.info('[google-button] request ready', {
    screen: input.screen,
    requestReady: input.requestReady,
  });
  console.info('[google-button] promptAsync exists', {
    screen: input.screen,
    promptAsyncExists: input.promptAsyncExists,
  });
}

export function getGoogleAuthStartBlockMessage(input: StartBlockInput) {
  if (input.termsRequired && !input.termsAccepted) {
    return 'You must accept the Terms of Use and Privacy Policy to continue.';
  }

  if (!googleAuthConfig.isConfigured) {
    return 'Google Sign-In is not configured for this build. Please contact MaltaPro support.';
  }

  if (!input.requestReady) {
    return 'Google Sign-In is still loading. Please try again in a moment.';
  }

  if (!input.promptAsyncExists) {
    return 'Google Sign-In is temporarily unavailable. Please restart the app and try again.';
  }

  return null;
}

export function logGooglePromptResult(screen: GoogleAuthScreen, result: AuthSessionResult | void) {
  if (!shouldLogGoogleAuthDiagnostics()) {
    return;
  }

  console.info('[google-auth] prompt result', {
    screen,
    type: result?.type ?? 'no-result',
    hasIdToken: result?.type === 'success' ? Boolean(result.params.id_token) : false,
  });
}

export function getGoogleResponseFailureMessage(result: AuthSessionResult) {
  if (result.type === 'success' || result.type === 'cancel' || result.type === 'dismiss') {
    return null;
  }

  if (result.type === 'error') {
    const description =
      result.params.error_description ??
      result.error?.message ??
      result.params.error ??
      result.errorCode;

    return description
      ? `Google Sign-In failed: ${description}`
      : 'Google Sign-In failed. Please try again.';
  }

  return 'Google Sign-In did not complete. Please try again.';
}
