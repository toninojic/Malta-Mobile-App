import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, CheckCircle2, MailCheck, RefreshCw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../api/client';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useTheme } from '../../design/theme';
import { ActivityStackParamList, AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/auth.store';

type Props =
  | NativeStackScreenProps<AuthStackParamList, 'VerifyEmail'>
  | NativeStackScreenProps<ActivityStackParamList, 'VerifyEmail'>;

export function VerifyEmailScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const updateUser = useAuthStore((state) => state.updateUser);
  const [token, setToken] = useState(route.params?.token ?? '');
  const [result, setResult] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: api.verifyEmail,
    onSuccess: async (response) => {
      if (response.user) {
        await updateUser(response.user);
      }
      setResult(response.alreadyVerified ? 'Your email is already verified.' : 'Your email has been verified.');
    },
    onError: (error) => setResult(error instanceof Error ? error.message : 'Could not verify email.'),
  });

  useEffect(() => {
    if (route.params?.token) {
      mutation.mutate(route.params.token);
    }
  }, [route.params?.token]);

  return (
    <Screen safeAreaTop>
      <Button title="Back" variant="ghost" icon={ArrowLeft} onPress={() => navigation.goBack()} style={styles.back} />
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Verify email</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Confirm your MaltaPro email address.</Text>
      </View>
      <TextField label="Verification token" value={token} onChangeText={setToken} autoCapitalize="none" />
      <Button title="Verify Email" icon={MailCheck} loading={mutation.isPending} onPress={() => mutation.mutate(token.trim())} />
      {result ? (
        <Card>
          <View style={styles.resultRow}>
            {result.includes('verified') ? <CheckCircle2 color={theme.colors.success} size={20} /> : <RefreshCw color={theme.colors.textMuted} size={20} />}
            <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>{result}</Text>
          </View>
        </Card>
      ) : null}
    </Screen>
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
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  resultRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
});
