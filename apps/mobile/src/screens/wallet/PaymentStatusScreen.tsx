import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CheckCircle2, Clock3, XCircle } from 'lucide-react-native';
import { ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../design/theme';
import { WalletStackParamList } from '../../navigation/types';

type StatusConfig = {
  icon: ComponentType<{ color?: string; size?: number }>;
  title: string;
  message: string;
  tone: 'primary' | 'danger' | 'warning';
};

export function PaymentSuccessScreen({ navigation }: NativeStackScreenProps<WalletStackParamList, 'PaymentSuccess'>) {
  return (
    <PaymentStatusView
      config={{
        icon: CheckCircle2,
        title: 'Purchase processing',
        message: 'Your token balance will refresh after the purchase is verified.',
        tone: 'primary',
      }}
      onDone={() => navigation.navigate('WalletHome')}
    />
  );
}

export function PaymentFailedScreen({ navigation }: NativeStackScreenProps<WalletStackParamList, 'PaymentFailed'>) {
  return (
    <PaymentStatusView
      config={{
        icon: XCircle,
        title: 'Payment failed',
        message: 'No tokens were added. You can try the package purchase again.',
        tone: 'danger',
      }}
      onDone={() => navigation.navigate('WalletHome')}
    />
  );
}

export function PaymentPendingScreen({ navigation }: NativeStackScreenProps<WalletStackParamList, 'PaymentPending'>) {
  return (
    <PaymentStatusView
      config={{
        icon: Clock3,
        title: 'Payment pending',
        message: 'The purchase has not completed yet. Your wallet will stay unchanged until verification succeeds.',
        tone: 'warning',
      }}
      onDone={() => navigation.navigate('WalletHome')}
    />
  );
}

function PaymentStatusView({ config, onDone }: { config: StatusConfig; onDone: () => void }) {
  const theme = useTheme();
  const Icon = config.icon;
  const toneColor = theme.colors[config.tone];

  return (
    <Screen>
      <View style={styles.center}>
        <View style={[styles.iconWrap, { backgroundColor: `${toneColor}18` }]}>
          <Icon color={toneColor} size={42} />
        </View>
        <Text style={[styles.title, { color: theme.colors.text }]}>{config.title}</Text>
        <Text style={[styles.message, { color: theme.colors.textMuted }]}>{config.message}</Text>
        <Button title="Back to Wallet" onPress={onDone} style={styles.button} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    gap: 16,
    justifyContent: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 8,
    height: 78,
    justifyContent: 'center',
    width: 78,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    width: '100%',
  },
});
