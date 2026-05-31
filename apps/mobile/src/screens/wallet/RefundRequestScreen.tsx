import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SendHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useCreateRefund } from '../../api/tokenHooks';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useTheme } from '../../design/theme';
import { WalletStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'RefundRequest'>;

export function RefundRequestScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const [reason, setReason] = useState('');
  const mutation = useCreateRefund();

  const submit = () => {
    if (reason.trim().length < 10) {
      Alert.alert('More detail needed', 'Refund reason must be at least 10 characters.');
      return;
    }

    mutation.mutate(
      {
        tokenTransactionId: route.params.transactionId,
        reason: reason.trim(),
      },
      {
        onSuccess: () => {
          Alert.alert('Refund requested', 'An admin can now review this request.');
          navigation.goBack();
        },
        onError: (error) => {
          Alert.alert('Could not request refund', error instanceof Error ? error.message : 'Please try again.');
        },
      },
    );
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Request refund</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Explain why this purchase should be refunded.</Text>
      </View>
      <TextField label="Reason" value={reason} onChangeText={setReason} multiline placeholder="Minimum 10 characters" />
      <Button title="Submit Request" icon={SendHorizontal} loading={mutation.isPending} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
  },
});
