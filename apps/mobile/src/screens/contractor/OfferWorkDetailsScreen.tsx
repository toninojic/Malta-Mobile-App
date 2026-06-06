import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Edit3, LockOpen, MessageCircle, RefreshCw, Star, Trash2 } from 'lucide-react-native';
import { useCallback } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { api } from '../../api/client';
import { useUnlockOffer } from '../../api/contactHooks';
import { invalidateMarketplaceState } from '../../api/invalidation';
import { useEnsureConversationForContact } from '../../api/messageHooks';
import { useOfferWorkDetails } from '../../api/offerWorkHooks';
import { useCompleteContact, useConfirmCompletion } from '../../api/reviewHooks';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { serviceCategoryLabel, serviceSubcategoryLabel } from '../../config/serviceCategories';
import { useTheme } from '../../design/theme';
import { JobsStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/auth.store';
import { formatDate } from '../../utils/date';

type Props = NativeStackScreenProps<JobsStackParamList, 'OfferWorkDetails'>;

export function OfferWorkDetailsScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const offerId = route.params.offerId;
  const query = useOfferWorkDetails(offerId);
  const unlockMutation = useUnlockOffer();
  const ensureConversationMutation = useEnsureConversationForContact();
  const completeMutation = useCompleteContact();
  const confirmMutation = useConfirmCompletion();
  const withdrawMutation = useMutation({
    mutationFn: api.withdrawOffer,
    onSuccess: async (offer) => {
      await invalidateMarketplaceState(queryClient, {
        offerId: offer.id,
        jobId: offer.jobRequestId,
        contactId: offer.contactId,
      });
      await query.refetch();
    },
  });

  useFocusEffect(
    useCallback(() => {
      void query.refetch();
    }, [query.refetch]),
  );

  const details = query.data;

  const refreshAfterAction = async () => {
    await invalidateMarketplaceState(queryClient, {
      offerId,
      jobId: details?.job.id,
      contactId: details?.contactUnlock?.id,
      includeTokens: true,
      includeReviews: true,
    });
    await query.refetch();
  };

  const openChat = () => {
    if (details?.conversation?.id) {
      navigation.getParent()?.navigate('MessagesTab', { screen: 'ConversationThread', params: { conversationId: details.conversation.id } });
      return;
    }

    if (!details?.contactUnlock?.id) {
      Alert.alert('Chat unavailable', 'Unlock contact before opening chat.');
      return;
    }

    ensureConversationMutation.mutate(details.contactUnlock.id, {
      onSuccess: async (conversation) => {
        await refreshAfterAction();
        navigation.getParent()?.navigate('MessagesTab', { screen: 'ConversationThread', params: { conversationId: conversation.id } });
      },
      onError: (error) => Alert.alert('Could not open chat', error instanceof Error ? error.message : 'Please try again.'),
    });
  };

  const unlockContact = () => {
    unlockMutation.mutate(offerId, {
      onSuccess: async () => {
        await refreshAfterAction();
      },
      onError: (error) => Alert.alert('Could not unlock contact', error instanceof Error ? error.message : 'Please try again.'),
    });
  };

  const markCompleted = () => {
    if (!details?.contactUnlock?.id) {
      return;
    }

    completeMutation.mutate(details.contactUnlock.id, {
      onSuccess: async () => {
        await refreshAfterAction();
        Alert.alert('Completion requested', 'The employer has been notified.');
      },
      onError: (error) => Alert.alert('Could not mark completed', error instanceof Error ? error.message : 'Please try again.'),
    });
  };

  const confirmCompletion = () => {
    if (!details?.contactUnlock?.id) {
      return;
    }

    confirmMutation.mutate(details.contactUnlock.id, {
      onSuccess: async () => {
        await refreshAfterAction();
        Alert.alert('Completion confirmed', 'Review is now available.');
      },
      onError: (error) => Alert.alert('Could not confirm completion', error instanceof Error ? error.message : 'Please try again.'),
    });
  };

  const withdraw = () => {
    Alert.alert('Withdraw offer', 'This offer will no longer appear to the employer.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: () =>
          withdrawMutation.mutate(offerId, {
            onError: (error) => Alert.alert('Could not withdraw offer', error instanceof Error ? error.message : 'Please try again.'),
          }),
      },
    ]);
  };

  if (query.error && !details) {
    return (
      <Screen>
        <EmptyState
          icon={RefreshCw}
          title="Could not load work details"
          message={query.error instanceof Error ? query.error.message : 'Please try again.'}
          actionTitle="Retry"
          onAction={() => void query.refetch()}
        />
      </Screen>
    );
  }

  if (query.isLoading || !details) {
    return (
      <Screen>
        <EmptyState icon={RefreshCw} title="Loading work details" message="Fetching fresh status from the server." />
      </Screen>
    );
  }

  const actions = details.availableActions;
  const isEmployer = user?.role === 'EMPLOYER' && details.contactUnlock?.employerId === user.id;
  const completionStatus = details.completion?.status ?? details.offer.completionStatus;
  const canEmployerReview = isEmployer && completionStatus === 'CONFIRMED' && !details.review && details.contactUnlock?.id;

  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <Card>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{details.job.title}</Text>
          <Badge status={details.offer.status} />
        </View>
        <Text style={[styles.copy, { color: theme.colors.textMuted }]}>{details.job.description}</Text>
        <Text style={[styles.meta, { color: theme.colors.text }]}>
          {serviceCategoryLabel(details.job.category)} / {serviceSubcategoryLabel(details.job.category, details.job.subcategory)}
        </Text>
        <View style={styles.badges}>
          <Badge status={details.job.status} />
          <Badge status={details.offer.unlockStatus} />
          {details.offer.completionStatus ? <Badge status={details.offer.completionStatus} /> : null}
        </View>
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Offer</Text>
        <Text style={[styles.price, { color: theme.colors.text }]}>EUR {details.offer.estimatedPrice}</Text>
        <Text style={[styles.copy, { color: theme.colors.textMuted }]}>Starts {formatDate(details.offer.startDate)}</Text>
        <Text style={[styles.copy, { color: theme.colors.textMuted }]}>{details.offer.estimatedCompletionDays} days estimated</Text>
        {details.offer.message ? <Text style={[styles.copy, { color: theme.colors.textMuted }]}>{details.offer.message}</Text> : null}
      </Card>

      {details.employer ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Employer</Text>
          <Text style={[styles.copy, { color: theme.colors.textMuted }]}>
            {details.employer.profile?.displayName ?? details.employer.email}
          </Text>
          <Text style={[styles.copy, { color: theme.colors.textMuted }]}>{details.employer.email}</Text>
        </Card>
      ) : null}

      {details.contractor?.portfolioImages?.length ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Portfolio</Text>
          <View style={styles.portfolio}>
            {details.contractor.portfolioImages.map((image) => (
              <Image key={image.id} source={{ uri: image.url }} style={styles.portfolioImage} />
            ))}
          </View>
        </Card>
      ) : null}

      <View style={styles.actions}>
        {actions.includes('UNLOCK_CONTACT') ? (
          <Button title="Unlock Contact - 1 token" icon={LockOpen} loading={unlockMutation.isPending} onPress={unlockContact} />
        ) : null}
        {actions.includes('OPEN_CHAT') ? (
          <Button title="Open Chat" icon={MessageCircle} variant="secondary" loading={ensureConversationMutation.isPending} onPress={openChat} />
        ) : null}
        {actions.includes('MARK_COMPLETED') ? (
          <Button title="Mark Job Completed" icon={CheckCircle2} variant="secondary" loading={completeMutation.isPending} onPress={markCompleted} />
        ) : null}
        {actions.includes('EDIT_OFFER') ? (
          <Button title="Edit Offer" icon={Edit3} variant="secondary" onPress={() => navigation.navigate('OfferForm', { jobId: details.job.id, offerId })} />
        ) : null}
        {actions.includes('VIEW_REVIEW') && details.review?.id ? (
          <Button
            title="View Review"
            icon={Star}
            variant="secondary"
            onPress={() => navigation.getParent()?.navigate('ActivityTab', { screen: 'ReviewDetails', params: { reviewId: details.review?.id ?? '' } })}
          />
        ) : null}
        {actions.includes('WITHDRAW_OFFER') ? (
          <Button title="Withdraw" icon={Trash2} variant="secondary" loading={withdrawMutation.isPending} onPress={withdraw} />
        ) : null}
        {isEmployer && completionStatus === 'PENDING_EMPLOYER_CONFIRMATION' ? (
          <Button
            title="Confirm Completion"
            icon={CheckCircle2}
            loading={confirmMutation.isPending}
            onPress={confirmCompletion}
          />
        ) : null}
        {canEmployerReview ? (
          <Button
            title="Leave Review"
            icon={Star}
            variant="secondary"
            onPress={() =>
              navigation.getParent()?.navigate('ActivityTab', {
                screen: 'LeaveReview',
                params: { contactId: details.contactUnlock?.id ?? '' },
              })
            }
          />
        ) : null}
        {isEmployer && details.review?.id ? (
          <Button
            title="View Review"
            icon={Star}
            variant="secondary"
            onPress={() =>
              navigation.getParent()?.navigate('ActivityTab', {
                screen: 'ReviewDetails',
                params: { reviewId: details.review?.id ?? '' },
              })
            }
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '900',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  price: {
    fontSize: 20,
    fontWeight: '900',
  },
  copy: {
    fontSize: 14,
    lineHeight: 21,
  },
  meta: {
    fontSize: 14,
    fontWeight: '800',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  portfolio: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  portfolioImage: {
    width: 92,
    height: 92,
    borderRadius: 8,
  },
  actions: {
    gap: 10,
  },
});
