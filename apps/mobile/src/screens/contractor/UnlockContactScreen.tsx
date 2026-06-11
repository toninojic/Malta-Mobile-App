import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { LockOpen, RefreshCw } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useUnlockOffer, useUnlockStatus } from '../../api/contactHooks';
import { api } from '../../api/client';
import { useEnsureConversationForContact } from '../../api/messageHooks';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { AppModal } from '../../components/AppModal';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../design/theme';
import { JobsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<JobsStackParamList, 'UnlockContact'>;

export function UnlockContactScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { offerId } = route.params;
  const balanceQuery = useQuery({
    queryKey: ['tokens', 'balance'],
    queryFn: api.tokenBalance,
    refetchOnWindowFocus: true,
  });
  const statusQuery = useUnlockStatus(offerId);
  const unlockMutation = useUnlockOffer();
  const ensureConversationMutation = useEnsureConversationForContact();
  const [unlockSuccess, setUnlockSuccess] = useState<{ contactId: string; balance: number } | null>(null);
  const cost = statusQuery.data?.cost ?? 1;
  const balance = balanceQuery.data?.balance ?? 0;
  const canUnlock = balance >= cost && statusQuery.data?.status !== 'UNLOCKED';

  useFocusEffect(
    useCallback(() => {
      void balanceQuery.refetch({ cancelRefetch: false });
      void statusQuery.refetch({ cancelRefetch: false });
    }, [balanceQuery.refetch, statusQuery.refetch]),
  );

  const confirmUnlock = () => {
    unlockMutation.mutate(offerId, {
      onSuccess: (result) => {
        setUnlockSuccess({ contactId: result.contact.id, balance: result.balance.balance });
      },
      onError: (error) => {
        Alert.alert('Could not unlock contact', error instanceof Error ? error.message : 'Please try again.');
      },
    });
  };

  if (balanceQuery.error || statusQuery.error) {
    const error = balanceQuery.error ?? statusQuery.error;
    return (
      <Screen>
        <EmptyState
          icon={RefreshCw}
          title="Could not load unlock details"
          message={error instanceof Error ? error.message : 'Please try again.'}
          actionTitle="Retry"
          onAction={() => {
            void balanceQuery.refetch();
            void statusQuery.refetch();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppModal
        visible={Boolean(unlockSuccess)}
        title="Contact Unlocked"
        body={`Your wallet balance is now ${unlockSuccess?.balance ?? balance} tokens.`}
        icon={LockOpen}
        actions={[
          {
            label: 'Later',
            onPress: () => {
              setUnlockSuccess(null);
              navigation.goBack();
            },
          },
          {
            label: 'Open Chat',
            variant: 'primary',
            onPress: () => {
              const contactId = unlockSuccess?.contactId;
              if (!contactId) {
                setUnlockSuccess(null);
                return;
              }

              setUnlockSuccess(null);
              ensureConversationMutation.mutate(contactId, {
                onSuccess: (conversation) => {
                  navigation
                    .getParent()
                    ?.navigate('MessagesTab', { screen: 'ConversationThread', params: { conversationId: conversation.id } });
                },
              });
            },
          },
        ]}
        onRequestClose={() => setUnlockSuccess(null)}
      />
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Unlock contact</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          You are about to spend 1 token to unlock contact information.
        </Text>
      </View>
      <Card>
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.colors.textMuted }]}>Current token balance</Text>
          <Text style={[styles.value, { color: theme.colors.text }]}>{balance}</Text>
        </View>
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.colors.textMuted }]}>Cost</Text>
          <Text style={[styles.value, { color: theme.colors.text }]}>{cost} token</Text>
        </View>
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.colors.textMuted }]}>Status</Text>
          <Text style={[styles.value, { color: theme.colors.text }]}>{statusQuery.data?.status ?? 'LOCKED'}</Text>
        </View>
      </Card>
      <Button
        title={statusQuery.data?.status === 'UNLOCKED' ? 'Already Unlocked' : 'Confirm Unlock'}
        icon={LockOpen}
        disabled={!canUnlock}
        loading={unlockMutation.isPending || balanceQuery.isLoading || statusQuery.isLoading}
        onPress={confirmUnlock}
      />
      {!canUnlock && statusQuery.data?.status !== 'UNLOCKED' ? (
        <>
          <Text style={[styles.warning, { color: theme.colors.danger }]}>You do not have enough tokens.</Text>
          <Button
            title="Buy Tokens"
            variant="secondary"
            onPress={() => navigation.getParent()?.navigate('ActivityTab', { screen: 'WalletHome' })}
          />
        </>
      ) : null}
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    fontSize: 14,
    flex: 1,
  },
  value: {
    fontSize: 16,
    fontWeight: '900',
  },
  warning: {
    fontSize: 14,
    lineHeight: 20,
  },
});
