import { useMutation } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Building2, HardHat, LockKeyhole, Mail, UserRound } from 'lucide-react-native';
import { ComponentType } from 'react';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../api/client';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useTheme } from '../../design/theme';
import { AuthStackParamList } from '../../navigation/types';
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

  const mutation = useMutation({
    mutationFn: api.register,
    onSuccess: async (session) => {
      await setSession(session);
    },
    onError: (error) => {
      Alert.alert('Registration failed', error instanceof Error ? error.message : 'Please try again.');
    },
  });

  const submit = () => {
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
    });
  };

  return (
    <Screen safeAreaTop>
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
      <Button title="Create Account" loading={mutation.isPending} onPress={submit} />
      <Button title="Log In" variant="secondary" onPress={() => navigation.navigate('Login')} />
    </Screen>
  );
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
});
