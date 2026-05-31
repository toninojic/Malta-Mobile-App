import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BriefcaseBusiness, CalendarClock, Edit3, LockOpen, RefreshCw, Trash2 } from 'lucide-react-native';
import { Alert, ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { api } from '../../api/client';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { serviceCategoryLabel, serviceSubcategoryLabel } from '../../config/serviceCategories';
import { useTheme } from '../../design/theme';
import { JobsStackParamList } from '../../navigation/types';
import { Offer } from '../../types/domain';

type Props = NativeStackScreenProps<JobsStackParamList, 'MyOffers'>;

export function MyOffersScreen({ navigation }: Props) {
  const theme = useTheme();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['offers', 'mine'],
    queryFn: () => api.myOffers({ limit: 50 }),
  });

  const withdrawMutation = useMutation({
    mutationFn: api.withdrawOffer,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['offers'] });
    },
    onError: (error) => {
      Alert.alert('Could not withdraw offer', error instanceof Error ? error.message : 'Please try again.');
    },
  });

  const confirmWithdraw = (offerId: string) => {
    Alert.alert('Withdraw offer', 'This offer will no longer appear to the employer.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Withdraw', style: 'destructive', onPress: () => withdrawMutation.mutate(offerId) },
    ]);
  };
  const activeOfferCount = query.data?.data.filter((offer) => offer.status === 'PENDING' || offer.status === 'SELECTED').length ?? 0;

  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>My offers</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          {activeOfferCount} active {activeOfferCount === 1 ? 'offer' : 'offers'} in progress.
        </Text>
      </View>

      {query.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : null}

      {query.error ? (
        <EmptyState
          icon={RefreshCw}
          title="Could not load offers"
          message={query.error instanceof Error ? query.error.message : 'Please try again.'}
          actionTitle="Retry"
          onAction={() => void query.refetch()}
        />
      ) : null}

      {query.data?.data.length === 0 ? (
        <EmptyState icon={BriefcaseBusiness} title="No offers yet" message="Browse active jobs and submit your first estimate." />
      ) : null}

      <View style={styles.list}>
        {query.data?.data.map((offer) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            withdrawing={withdrawMutation.isPending}
            onOpenJob={() => navigation.navigate('JobDetails', { jobId: offer.jobRequestId })}
            onEdit={() => navigation.navigate('OfferForm', { jobId: offer.jobRequestId, offerId: offer.id })}
            onUnlock={() => navigation.navigate('UnlockContact', { offerId: offer.id })}
            onOpenChat={
              offer.contactId
                ? () =>
                    navigation
                      .getParent()
                      ?.navigate('MessagesTab', { screen: 'ConversationThread', params: { conversationId: offer.contactId } })
                : undefined
            }
            onWithdraw={() => confirmWithdraw(offer.id)}
          />
        ))}
      </View>
    </Screen>
  );
}

function OfferCard({
  offer,
  withdrawing,
  onOpenJob,
  onEdit,
  onUnlock,
  onOpenChat,
  onWithdraw,
}: {
  offer: Offer;
  withdrawing: boolean;
  onOpenJob: () => void;
  onEdit: () => void;
  onUnlock: () => void;
  onOpenChat?: () => void;
  onWithdraw: () => void;
}) {
  const theme = useTheme();
  const isWithdrawn = offer.status === 'WITHDRAWN';
  const isUnlocked = offer.unlockStatus === 'UNLOCKED';

  return (
    <Card onPress={onOpenJob}>
      <View style={styles.cardTop}>
        <View style={styles.cardTitleWrap}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{offer.jobRequest?.title ?? 'Job request'}</Text>
          <Text style={[styles.cardMeta, { color: theme.colors.textMuted }]}>
            {offer.jobRequest
              ? `${serviceCategoryLabel(offer.jobRequest.category)} / ${serviceSubcategoryLabel(offer.jobRequest.category, offer.jobRequest.subcategory)}`
              : 'Category / Subcategory'}
          </Text>
        </View>
        <Badge status={offer.status} />
      </View>
      <View style={styles.metaRow}>
        <CalendarClock color={theme.colors.textMuted} size={16} />
        <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>
          EUR {offer.estimatedPrice} / {offer.estimatedCompletionDays} days
        </Text>
      </View>
      {offer.message ? (
        <Text numberOfLines={2} style={[styles.message, { color: theme.colors.textMuted }]}>
          {offer.message}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button title="Edit Offer" icon={Edit3} variant="secondary" disabled={isWithdrawn} onPress={onEdit} style={styles.actionButton} />
        <Button
          title={isUnlocked ? 'Message' : 'Unlock Contact'}
          icon={LockOpen}
          variant={isUnlocked ? 'primary' : 'secondary'}
          disabled={isWithdrawn}
          onPress={isUnlocked && onOpenChat ? onOpenChat : onUnlock}
          style={styles.actionButton}
        />
        <Button
          title="Withdraw"
          icon={Trash2}
          variant="danger"
          disabled={isWithdrawn}
          loading={withdrawing}
          onPress={onWithdraw}
          style={styles.actionButton}
        />
      </View>
    </Card>
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
  center: {
    paddingVertical: 32,
  },
  list: {
    gap: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardTitleWrap: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  cardMeta: {
    fontSize: 13,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 13,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    minWidth: 104,
  },
});
