import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, CheckCircle2, LockKeyhole } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../api/client';
import { AppModal } from '../../components/AppModal';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useTheme } from '../../design/theme';
import { ActivityStackParamList, AuthStackParamList } from '../../navigation/types';

type Props =
  | NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>
  | NativeStackScreenProps<ActivityStackParamList, 'ResetPassword'>;

export function ResetPasswordScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const [token, setToken] = useState(route.params?.token ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [successOpen, setSuccessOpen] = useState(false);
  const mutation = useMutation({
    mutationFn: api.resetPassword,
    onSuccess: () => setSuccessOpen(true),
    onError: (error) => Alert.alert('Could not reset password', error instanceof Error ? error.message : 'Please try again.'),
  });

  const submit = () => {
    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please enter the same password twice.');
      return;
    }
    mutation.mutate({ token: token.trim(), newPassword: password });
  };

  return (
    <Screen safeAreaTop>
      <AppModal
        visible={successOpen}
        title="Password Reset"
        body="Your password has been updated. Please log in with your new password."
        icon={CheckCircle2}
        actions={[
          {
            label: 'Close',
            variant: 'primary',
            onPress: () => {
              setSuccessOpen(false);
              navigation.goBack();
            },
          },
        ]}
        onRequestClose={() => setSuccessOpen(false)}
      />
      <Button title="Back" variant="ghost" icon={ArrowLeft} onPress={() => navigation.goBack()} style={styles.back} />
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Choose new password</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Use the token from your reset email.</Text>
      </View>
      <TextField label="Reset token" value={token} onChangeText={setToken} autoCapitalize="none" />
      <TextField label="New password" icon={LockKeyhole} value={password} onChangeText={setPassword} secureTextEntry />
      <TextField label="Confirm password" icon={LockKeyhole} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
      <Button title="Reset Password" icon={CheckCircle2} loading={mutation.isPending} onPress={submit} />
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
    fontSize: 15,
    lineHeight: 22,
  },
});
