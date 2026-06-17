import { useMutation } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Mail, LockKeyhole, LogIn } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { api } from '../../api/client';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useTheme } from '../../design/theme';
import { AuthStackParamList } from '../../navigation/types';
import { configureRevenueCatForCurrentUser } from '../../services/revenueCatPurchases';
import { useAuthStore } from '../../store/auth.store';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const theme = useTheme();
  const setSession = useAuthStore((state) => state.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: api.login,
    onSuccess: async (session) => {
      await setSession(session);
      await configureRevenueCatForCurrentUser({ forceDiagnostics: true });
    },
    onError: (error) => {
      Alert.alert('Login failed', error instanceof Error ? error.message : 'Please try again.');
    },
  });

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
