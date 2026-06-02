import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import {
  BriefcaseBusiness,
  CalendarClock,
  Edit3,
  Eye,
  LockOpen,
  MessageCircle,
  RefreshCw,
  Trash2,
} from 'lucide-react-native';
import { ComponentType, useCallback } from 'react';
import { Alert, ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../api/client';
import { cacheOffer, invalidateMarketplaceState } from '../../api/invalidation';
import { useEnsureConversationForContact } from '../../api/messageHooks';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { serviceCategoryLabel, serviceSubcategoryLabel } from '../../config/serviceCategories';
import { useTheme } from '../../design/theme';
import { JobsStackParamList } from '../../navigation/types';
import { Offer } from '../../types/domain';

type Props = NativeStackScreenProps<JobsStackParamList, 'MyOffers'>;

export function MyOffersScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const ensureConversationMutation = useEnsureConversationForContact();
  const view = route.params?.view ?? 'all';

  const query = useQuery({
    queryKey: ['offers', 'mine'],
    queryFn: () => api.myOffers({ limit: 50 }),
    refetchOnWindowFocus: true,
  });

  useFocusEffect(
    useCallback(() => {
      void query.refetch({ cancelRefetch: false });
    }, [query.refetch]),
  );

  const withdrawMutation = useMutation({
    mutationFn: api.withdrawOffer,
    onSuccess: async (offer) => {
      cacheOffer(queryClient, offer);
      await invalidateMarketplaceState(queryClient, {
        jobId: offer.jobRequestId,
        offerId: offer.id,
        contractorId: offer.contractorId,
      });
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
  const allOffers = query.data?.data ?? [];
  const offers = view === 'selected' ? allOffers.filter((offer) => offer.status === 'SELECTED') : allOffers;
  const activeOfferCount = offers.filter((offer) => offer.status === 'PENDING' || offer.status === 'SELECTED').length;
  const isSelectedView = view === 'selected';

  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{isSelectedView ? 'Selected offers' : 'My offers'}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          {isSelectedView
            ? `${offers.length} selected ${offers.length === 1 ? 'offer' : 'offers'} ready for contact unlock.`
            : `${activeOfferCount} active ${activeOfferCount === 1 ? 'offer' : 'offers'} in progress.`}
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

      {!query.isLoading && !query.error && offers.length === 0 ? (
        <EmptyState
          icon={BriefcaseBusiness}
          title={isSelectedView ? 'No selected offers yet' : 'No offers yet'}
          message={
            isSelectedView
              ? 'When an employer selects your offer, it will appear here.'
              : 'Browse active jobs and submit your first estimate.'
          }
        />
      ) : null}

      <View style={styles.list}>
        {offers.map((offer) => (
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
                    ensureConversationMutation.mutate(offer.contactId as string, {
                      onSuccess: (conversation) => {
                        navigation
                          .getParent()
                          ?.navigate('MessagesTab', { screen: 'ConversationThread', params: { conversationId: conversation.id } });
                      },
                      onError: (error) => {
                        Alert.alert('Could not open chat', error instanceof Error ? error.message : 'Please try again.');
                      },
                    })
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
  const isCompleted = offer.status === 'COMPLETED';
  const isUnlocked = offer.unlockStatus === 'UNLOCKED';
  const canManage = !isWithdrawn && !isCompleted;
  const canUnlock = canManage && offer.status === 'SELECTED' && !isUnlocked;

  return (
    <Card>
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
        <IconActionButton label="View job" icon={Eye} onPress={onOpenJob} />
        {canManage ? (
          <IconActionButton label="Edit offer" icon={Edit3} onPress={onEdit} disabled={isWithdrawn} />
        ) : null}
        {isUnlocked && onOpenChat ? (
          <IconActionButton label="Message" icon={MessageCircle} variant="primary" onPress={onOpenChat} />
        ) : null}
        {!isUnlocked && canManage ? (
          <IconActionButton
            label="Unlock contact"
            icon={LockOpen}
            onPress={onUnlock}
            disabled={!canUnlock}
          />
        ) : null}
        {canManage ? (
          <IconActionButton
            label="Withdraw offer"
            icon={Trash2}
            variant="danger"
            loading={withdrawing}
            onPress={onWithdraw}
          />
        ) : null}
      </View>
    </Card>
  );
}

function IconActionButton({
  label,
  icon: Icon,
  onPress,
  variant = 'secondary',
  disabled,
  loading,
}: {
  label: string;
  icon: ComponentType<{ color?: string; size?: number }>;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}) {
  const theme = useTheme();
  const colors = {
    primary: {
      background: theme.colors.primary,
      border: theme.colors.primary,
      icon: '#FFFFFF',
    },
    secondary: {
      background: theme.colors.surfaceMuted,
      border: theme.colors.border,
      icon: theme.colors.text,
    },
    danger: {
      background: theme.colors.danger,
      border: theme.colors.danger,
      icon: '#FFFFFF',
    },
  }[variant];

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
          opacity: disabled ? 0.45 : pressed ? 0.78 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.icon} />
      ) : (
        <Icon color={colors.icon} size={20} />
      )}
    </Pressable>
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
    gap: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
