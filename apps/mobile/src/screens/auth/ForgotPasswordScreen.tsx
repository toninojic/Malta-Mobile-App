import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Mail, SendHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../api/client';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useTheme } from '../../design/theme';
import { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [debugToken, setDebugToken] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: api.forgotPassword,
    onSuccess: (response) => {
      setSentMessage(response.message);
      setDebugToken(response.debugPasswordResetToken ?? null);
    },
    onError: (error) => Alert.alert('Could not send reset link', error instanceof Error ? error.message : 'Please try again.'),
  });

  return (
    <Screen safeAreaTop>
      <Button title="Back" variant="ghost" icon={ArrowLeft} onPress={() => navigation.goBack()} style={styles.back} />
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Reset password</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Enter your email and we will send reset instructions.</Text>
      </View>
      <TextField
        label="Email"
        icon={Mail}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Button
        title="Send Reset Link"
        icon={SendHorizontal}
        loading={mutation.isPending}
        onPress={() => mutation.mutate(email.trim().toLowerCase())}
      />
      {sentMessage ? (
        <Card>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Check your email</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>{sentMessage}</Text>
          {debugToken ? (
            <Button
              title="Open Dev Reset"
              variant="secondary"
              onPress={() => navigation.navigate('ResetPassword', { token: debugToken })}
            />
          ) : null}
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
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
});
