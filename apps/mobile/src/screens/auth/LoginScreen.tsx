import { useMutation } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Mail, LockKeyhole, LogIn } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { api } from '../../api/client';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useTheme } from '../../design/theme';
import { AuthStackParamList } from '../../navigation/types';
import { clearContractorSetupRequirement, getContractorSetupDecision } from '../../services/contractorSetup';
import { googleAuthIsConfigured, useGoogleIdTokenRequest } from '../../services/googleSignIn';
import { configureRevenueCatForCurrentUser } from '../../services/revenueCatPurchases';
import { useAuthStore } from '../../store/auth.store';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const theme = useTheme();
  const setSession = useAuthStore((state) => state.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [googleRequest, googleResponse, promptGoogleAsync] = useGoogleIdTokenRequest();

  const completeLogin = async (session: Awaited<ReturnType<typeof api.login>>, authAction: 'login' | 'google-login') => {
    clearContractorSetupRequirement(session.user.id);
    const setupDecision = getContractorSetupDecision(session.user);
    console.info('[contractor-setup] auth action', {
      authAction,
      userId: session.user.id,
      role: session.user.role,
      isNewlyRegistered: false,
      contractorOnboardingRequired: setupDecision.contractorOnboardingRequired,
      contractorOnboardingCompleted: setupDecision.contractorOnboardingCompleted,
      contractorOnboardingSkipped: setupDecision.contractorOnboardingSkipped,
      finalNavigationTarget: 'app',
    });
    await setSession(session);
    await configureRevenueCatForCurrentUser({ forceDiagnostics: true });
  };

  const mutation = useMutation({
    mutationFn: api.login,
    onSuccess: (session) => completeLogin(session, 'login'),
    onError: (error) => {
      Alert.alert('Login failed', error instanceof Error ? error.message : 'Please try again.');
    },
  });

  const googleMutation = useMutation({
    mutationFn: api.googleAuth,
    onSuccess: (session) => completeLogin(session, 'google-login'),
    onError: (error) => {
      Alert.alert('Google login failed', error instanceof Error ? error.message : 'Please use Register with Google if this is a new account.');
    },
  });

  useEffect(() => {
    if (googleResponse?.type !== 'success') {
      return;
    }

    const idToken = googleResponse.params.id_token;
    if (!idToken) {
      Alert.alert('Google login failed', 'Google did not return an ID token.');
      return;
    }

    googleMutation.mutate({ idToken });
  }, [googleResponse?.type]);

  return (
    <Screen safeAreaTop>
      <Button title="Back" variant="ghost" icon={ArrowLeft} onPress={() => navigation.goBack()} style={styles.back} />
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Welcome back</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Sign in to continue your Malta work board.</Text>
      </View>
      <TextField
        label="Email"
        icon={Mail}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="emailAddress"
      />
      <TextField
        label="Password"
        icon={LockKeyhole}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="password"
      />
      <Button
        title="Log In"
        icon={LogIn}
        loading={mutation.isPending}
        onPress={() => mutation.mutate({ email: email.trim(), password })}
      />
      <Button
        title="Continue with Google"
        variant="secondary"
        loading={googleMutation.isPending}
        disabled={!googleAuthIsConfigured() || !googleRequest}
        onPress={() => void promptGoogleAsync()}
      />
      <Button title="Forgot your password?" variant="ghost" onPress={() => navigation.navigate('ForgotPassword')} />
      <Button title="Create Account" variant="secondary" onPress={() => navigation.navigate('Register')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    alignSelf: 'flex-start',
  },
  header: {
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 23,
  },
});
