import { useMutation } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Building2, Check, HardHat, LockKeyhole, Mail, Square, UserRound } from 'lucide-react-native';
import { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../api/client';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { legalLinks, openLegalLink } from '../../config/legalLinks';
import { useTheme } from '../../design/theme';
import { AuthStackParamList } from '../../navigation/types';
import { track } from '../../services/analytics';
import { getContractorSetupDecision, markContractorSetupRequired } from '../../services/contractorSetup';
import { googleAuthIsConfigured, useGoogleIdTokenRequest } from '../../services/googleSignIn';
import { configureRevenueCatForCurrentUser } from '../../services/revenueCatPurchases';
import { useAuthStore } from '../../store/auth.store';
import { UserRole } from '../../types/domain';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;
type RegisterRole = Exclude<UserRole, 'ADMIN'>;

export function RegisterScreen({ navigation }: Props) {
  const theme = useTheme();
  const setSession = useAuthStore((state) => state.setSession);
  const [role, setRole] = useState<RegisterRole>('EMPLOYER');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [tradeCategories, setTradeCategories] = useState('');
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [googleRequest, googleResponse, promptGoogleAsync] = useGoogleIdTokenRequest();

  const completeRegistration = async (session: Awaited<ReturnType<typeof api.register>>, authAction: 'register' | 'google-register') => {
    if (session.user.role === 'CONTRACTOR') {
      await markSetupRequiredWithTimeout(session.user.id);
    }
    const setupDecision = getContractorSetupDecision(session.user);
    console.info('[contractor-setup] auth action', {
      authAction,
      userId: session.user.id,
      role: session.user.role,
      isNewlyRegistered: session.user.role === 'CONTRACTOR',
      contractorOnboardingRequired: setupDecision.contractorOnboardingRequired,
      contractorOnboardingCompleted: setupDecision.contractorOnboardingCompleted,
      contractorOnboardingSkipped: setupDecision.contractorOnboardingSkipped,
      finalNavigationTarget: setupDecision.finalNavigationTarget,
    });
    await setSession(session);
    await configureRevenueCatForCurrentUser({ forceDiagnostics: true });
    if (authAction === 'register' && session.verificationEmailSent) {
      Alert.alert('Check your email', 'We sent you a MaltaPro verification link. You can continue using the app and verify from Profile.');
    }
  };

  const mutation = useMutation({
    mutationFn: api.register,
    onSuccess: (session) => completeRegistration(session, 'register'),
    onError: (error) => {
      Alert.alert('Registration failed', error instanceof Error ? error.message : 'Please try again.');
    },
  });

  const googleMutation = useMutation({
    mutationFn: api.googleAuth,
    onSuccess: (session) => completeRegistration(session, 'google-register'),
    onError: (error) => {
      Alert.alert('Google registration failed', error instanceof Error ? error.message : 'Please try again.');
    },
  });

  useEffect(() => {
    if (googleResponse?.type !== 'success') {
      return;
    }

    const idToken = googleResponse.params.id_token;
    if (!idToken) {
      Alert.alert('Google registration failed', 'Google did not return an ID token.');
      return;
    }

    googleMutation.mutate({
      idToken,
      role,
      termsAccepted: legalAccepted,
      privacyAccepted: legalAccepted,
    });
  }, [googleResponse?.type]);

  const submit = () => {
    if (!legalAccepted) {
      Alert.alert('Consent required', 'You must accept the Terms of Use and Privacy Policy to continue.');
      return;
    }

    mutation.mutate({
      role,
      displayName,
      email,
      password,
      phone,
      location,
      companyName: role === 'CONTRACTOR' ? companyName : undefined,
      tradeCategories:
        role === 'CONTRACTOR'
          ? tradeCategories
              .split(',')
              .map((category) => category.trim())
              .filter(Boolean)
          : [],
      termsAccepted: legalAccepted,
      privacyAccepted: legalAccepted,
    });
  };

  const startGoogleRegistration = () => {
    if (!legalAccepted) {
      Alert.alert('Consent required', 'You must accept the Terms of Use and Privacy Policy to continue.');
      return;
    }
    track('GOOGLE_LOGIN_STARTED', { screen: 'Register', metadata: { role } });
    void promptGoogleAsync();
  };

  return (
    <Screen safeAreaTop safeAreaBottom contentBottomPadding={32}>
      <Button title="Back" variant="ghost" icon={ArrowLeft} onPress={() => navigation.goBack()} style={styles.back} />
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Create account</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Choose how you will use the marketplace.</Text>
      </View>
      <View style={[styles.segment, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
        <RoleOption title="Employer" icon={Building2} active={role === 'EMPLOYER'} onPress={() => setRole('EMPLOYER')} />
        <RoleOption title="Contractor" icon={HardHat} active={role === 'CONTRACTOR'} onPress={() => setRole('CONTRACTOR')} />
      </View>
      <TextField label="Display name" icon={UserRound} value={displayName} onChangeText={setDisplayName} />
      <TextField label="Email" icon={Mail} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextField label="Password" icon={LockKeyhole} value={password} onChangeText={setPassword} secureTextEntry />
      <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextField label="Location" value={location} onChangeText={setLocation} />
      {role === 'CONTRACTOR' ? (
        <>
          <TextField label="Company name" value={companyName} onChangeText={setCompanyName} />
          <TextField label="Trade categories" value={tradeCategories} onChangeText={setTradeCategories} />
        </>
      ) : null}
      <LegalConsent checked={legalAccepted} onChange={setLegalAccepted} />
      <Button
        title="Create Account"
        loading={mutation.isPending}
        disabled={!legalAccepted}
        onPress={submit}
      />
      <Button
        title={`Continue with Google as ${role === 'EMPLOYER' ? 'Employer' : 'Contractor'}`}
        variant="secondary"
        loading={googleMutation.isPending}
        disabled={!legalAccepted || !googleAuthIsConfigured() || !googleRequest}
        onPress={startGoogleRegistration}
      />
      <Button title="Log In" variant="secondary" onPress={() => navigation.navigate('Login')} />
    </Screen>
  );
}

function LegalConsent({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.legalConsent, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={() => onChange(!checked)}
        hitSlop={8}
        style={[
          styles.checkbox,
          {
            backgroundColor: checked ? theme.colors.success : theme.colors.surfaceMuted,
            borderColor: checked ? theme.colors.success : theme.colors.border,
          },
        ]}
      >
        {checked ? <Check color="#FFFFFF" size={16} /> : <Square color="transparent" size={16} />}
      </Pressable>
      <Text style={[styles.legalText, { color: theme.colors.textMuted }]}>
        I agree to the{' '}
        <Text
          accessibilityRole="link"
          onPress={() => void openLegalLink(legalLinks.termsOfUse)}
          style={[styles.legalLink, { color: theme.colors.success }]}
        >
          Terms of Use
        </Text>
        {' '}and{' '}
        <Text
          accessibilityRole="link"
          onPress={() => void openLegalLink(legalLinks.privacyPolicy)}
          style={[styles.legalLink, { color: theme.colors.success }]}
        >
          Privacy Policy
        </Text>
        .
      </Text>
    </View>
  );
}

async function markSetupRequiredWithTimeout(userId: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  await Promise.race([
    markContractorSetupRequired(userId),
    new Promise<void>((resolve) => {
      timeoutId = setTimeout(() => {
        console.warn('[contractor-setup] mark required timed out; continuing registration', { userId });
        resolve();
      }, 1_500);
    }),
  ]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

function RoleOption({
  title,
  active,
  onPress,
  icon: Icon,
}: {
  title: string;
  active: boolean;
  onPress: () => void;
  icon: ComponentType<{ color?: string; size?: number }>;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.roleOption,
        {
          backgroundColor: active ? theme.colors.surface : 'transparent',
          borderColor: active ? theme.colors.primary : 'transparent',
        },
      ]}
    >
      <Icon color={active ? theme.colors.primary : theme.colors.textMuted} size={18} />
      <Text style={[styles.roleText, { color: active ? theme.colors.text : theme.colors.textMuted }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: {
    alignSelf: 'flex-start',
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 16,
  },
  segment: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 4,
    gap: 4,
  },
  roleOption: {
    flex: 1,
    minHeight: 48,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '800',
  },
  legalConsent: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  checkbox: {
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    marginTop: 1,
    width: 24,
  },
  legalText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  legalLink: {
    fontWeight: '900',
    textDecorationLine: 'underline',
  },
});
