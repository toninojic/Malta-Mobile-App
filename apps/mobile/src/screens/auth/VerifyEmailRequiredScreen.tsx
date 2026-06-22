import { useMutation } from '@tanstack/react-query';
import { LogOut, MailCheck, RefreshCw, Send } from 'lucide-react-native';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { api } from '../../api/client';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../design/theme';
import { useAuthStore } from '../../store/auth.store';

export function VerifyEmailRequiredScreen() {
  const theme = useTheme();
  const clearSession = useAuthStore((state) => state.clearSession);
  const updateUser = useAuthStore((state) => state.updateUser);
  const user = useAuthStore((state) => state.user);

  const resendMutation = useMutation({
    mutationFn: api.sendEmailVerification,
    onSuccess: () => {
      Alert.alert('Email sent', 'We sent you a new MaltaPro verification link.');
    },
    onError: (error) => {
      Alert.alert('Could not send email', error instanceof Error ? error.message : 'Please try again.');
    },
  });

  const refreshMutation = useMutation({
    mutationFn: api.me,
    onSuccess: async (nextUser) => {
      await updateUser(nextUser);
      if (!nextUser.emailVerifiedAt) {
        Alert.alert('Not verified yet', 'Please open the verification link from your email, then try again.');
      }
    },
    onError: (error) => {
      Alert.alert('Could not refresh status', error instanceof Error ? error.message : 'Please try again.');
    },
  });
  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSettled: () => {
      void clearSession();
    },
  });

  return (
    <Screen safeAreaTop safeAreaBottom>
      <View style={[styles.iconWrap, { backgroundColor: `${theme.colors.success}18` }]}>
        <MailCheck color={theme.colors.success} size={34} />
      </View>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Verify your email</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          Please verify your email address to continue using MaltaPro.
        </Text>
        {user?.email ? <Text style={[styles.email, { color: theme.colors.text }]}>{user.email}</Text> : null}
      </View>
      <View style={styles.actions}>
        <Button
          title="Resend verification email"
          icon={Send}
          loading={resendMutation.isPending}
          onPress={() => resendMutation.mutate()}
        />
        <Button
          title="I verified my email"
          icon={RefreshCw}
          variant="secondary"
          loading={refreshMutation.isPending}
          onPress={() => refreshMutation.mutate()}
        />
        <Button
          title="Logout"
          icon={LogOut}
          variant="ghost"
          loading={logoutMutation.isPending}
          onPress={() => logoutMutation.mutate()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    borderRadius: 18,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  header: {
    gap: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 23,
  },
  email: {
    fontSize: 15,
    fontWeight: '800',
  },
  actions: {
    gap: 10,
  },
});
