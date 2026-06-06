import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowRight, Hammer, LogIn } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../design/theme';
import { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;

export function OnboardingScreen({ navigation }: Props) {
  const theme = useTheme();

  return (
    <Screen scroll={false} safeAreaTop>
      <View style={styles.wrap}>
        <View style={[styles.mark, { backgroundColor: theme.colors.primary }]}>
          <Hammer color="#FFFFFF" size={34} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.kicker, { color: theme.colors.primary }]}>Malta Craftsman</Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Trusted trade work, matched faster.
          </Text>
          <Text style={[styles.body, { color: theme.colors.textMuted }]}>
            Employers post job requests. Contractors respond when the fit is right.
          </Text>
        </View>
        <View style={styles.actions}>
          <Button title="Create Account" icon={ArrowRight} onPress={() => navigation.navigate('Register')} />
          <Button title="Log In" icon={LogIn} variant="secondary" onPress={() => navigation.navigate('Login')} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    gap: 32,
  },
  mark: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    gap: 12,
  },
  kicker: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 42,
  },
  body: {
    fontSize: 17,
    lineHeight: 25,
  },
  actions: {
    gap: 12,
  },
});
