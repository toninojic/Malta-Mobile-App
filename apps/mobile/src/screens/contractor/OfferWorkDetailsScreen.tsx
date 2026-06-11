import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Edit3, LockOpen, MessageCircle, RefreshCw, Star, Trash2, UserRound } from 'lucide-react-native';
import { ComponentType, useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { AppModal, AppModalAction } from '../../components/AppModal';
import { ImageViewerModal } from '../../components/ImageViewerModal';
import { Screen } from '../../components/Screen';
import { serviceCategoryLabel, serviceSubcategoryLabel } from '../../config/serviceCategories';
import { useTheme } from '../../design/theme';
import { JobsStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/auth.store';
import { formatDate } from '../../utils/date';

type Props = NativeStackScreenProps<JobsStackParamList, 'OfferWorkDetails'>;
type BusinessModalState = {
  title: string;
  body: string;
  icon?: ComponentType<{ color?: string; size?: number }>;
  actions: AppModalAction[];
};

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
  const [portfolioViewerIndex, setPortfolioViewerIndex] = useState(0);
  const [portfolioViewerOpen, setPortfolioViewerOpen] = useState(false);
  const [jobImageViewerIndex, setJobImageViewerIndex] = useState(0);
  const [jobImageViewerOpen, setJobImageViewerOpen] = useState(false);
  const [employerInfoOpen, setEmployerInfoOpen] = useState(false);
  const [businessModal, setBusinessModal] = useState<BusinessModalState | null>(null);
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
        setBusinessModal({
          title: 'Completion Requested',
          body: 'The employer has been notified.',
          icon: CheckCircle2,
          actions: [{ label: 'Close', variant: 'primary', onPress: () => setBusinessModal(null) }],
        });
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
        setBusinessModal({
          title: 'Completion Confirmed',
          body: 'Review is now available.',
          icon: CheckCircle2,
          actions: [{ label: 'Close', variant: 'primary', onPress: () => setBusinessModal(null) }],
        });
      },
      onError: (error) => Alert.alert('Could not confirm completion', error instanceof Error ? error.message : 'Please try again.'),
    });
  };

  const withdraw = () => {
    setBusinessModal({
      title: 'Withdraw Offer',
      body: 'This offer will no longer appear to the employer.',
      icon: Trash2,
      actions: [
        { label: 'Cancel', onPress: () => setBusinessModal(null) },
        {
          label: 'Withdraw',
          variant: 'danger',
          onPress: () => {
            setBusinessModal(null);
            withdrawMutation.mutate(offerId, {
              onError: (error) => Alert.alert('Could not withdraw offer', error instanceof Error ? error.message : 'Please try again.'),
            });
          },
        },
      ],
    });
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
  const canContractorReviewEmployer =
    user?.role === 'CONTRACTOR' &&
    details.contactUnlock?.contractorId === user.id &&
    completionStatus === 'CONFIRMED' &&
    !details.employerReview &&
    details.contactUnlock?.id;
  const employerReviewId = details.employerReview?.id;
  const isCompleted =
    details.offer.status === 'COMPLETED' ||
    details.offer.completionStatus === 'CONFIRMED' ||
    details.job.status === 'COMPLETED';
  const isSelectedActive = details.offer.status === 'SELECTED' && details.offer.unlockStatus !== 'UNLOCKED' && !isCompleted;
  const showSelectedHistory = details.offer.selectedByEmployer && !isSelectedActive;
  const headlineStatus = isCompleted
    ? 'COMPLETED'
    : details.offer.completionStatus ?? (details.offer.unlockStatus === 'UNLOCKED' ? details.job.status : details.offer.status);
  const employerInfoBody = details.employer
    ? [
        details.employer.profile?.displayName ?? details.employer.email,
        details.employer.email,
        details.employer.profile?.phone ? `Phone: ${details.employer.profile.phone}` : null,
        details.employer.profile?.location ? `Location: ${details.employer.profile.location}` : null,
        details.employer.profile?.companyName ? `Company: ${details.employer.profile.companyName}` : null,
        details.employerRatingSummary?.totalReviews
          ? `Rating: ${Number(details.employerRatingSummary.averageRating).toFixed(1)} (${details.employerRatingSummary.totalReviews})`
          : 'No employer reviews yet',
        details.employer.profile?.bio ? `Bio: ${details.employer.profile.bio}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <AppModal
        visible={Boolean(businessModal)}
        title={businessModal?.title ?? ''}
        body={businessModal?.body ?? ''}
        icon={businessModal?.icon}
        actions={businessModal?.actions ?? []}
        onRequestClose={() => setBusinessModal(null)}
      />
      <AppModal
        visible={employerInfoOpen}
        title="Employer Info"
        body={employerInfoBody}
        icon={UserRound}
        media={
          details.employer ? (
            <View style={styles.employerModalAvatarWrap}>
              {details.employer.profile?.avatarUrl ? (
                <Image source={{ uri: details.employer.profile.avatarUrl }} style={styles.employerModalAvatar} />
              ) : (
                <View style={[styles.employerModalAvatarFallback, { backgroundColor: theme.colors.surfaceMuted }]}>
                  <UserRound color={theme.colors.success} size={34} />
                </View>
              )}
            </View>
          ) : null
        }
        actions={[{ label: 'Close', variant: 'primary', onPress: () => setEmployerInfoOpen(false) }]}
        onRequestClose={() => setEmployerInfoOpen(false)}
      />
      <Card
        style={
          isSelectedActive
            ? {
                backgroundColor: `${theme.colors.primary}10`,
                borderColor: theme.colors.primary,
              }
            : undefined
        }
      >
        {isSelectedActive ? (
          <View style={[styles.selectedNotice, { backgroundColor: `${theme.colors.primary}18`, borderColor: theme.colors.primary }]}>
            <Text style={[styles.selectedBadge, { color: theme.colors.primary }]}>SELECTED</Text>
            <Text style={[styles.selectedText, { color: theme.colors.text }]}>Selected by employer</Text>
          </View>
        ) : null}
        {showSelectedHistory ? (
          <Text style={[styles.historyText, { color: theme.colors.textMuted }]}>Selected by employer</Text>
        ) : null}
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{details.job.title}</Text>
          {!isSelectedActive ? <Badge status={headlineStatus} /> : null}
        </View>
        <Text style={[styles.copy, { color: theme.colors.textMuted }]}>{details.job.description}</Text>
        {details.job.images.length ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.jobImages}>
              {details.job.images.map((image, index) => (
                <Pressable
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`Open job image ${index + 1}`}
                  key={image.id}
                  onPress={() => {
                    setJobImageViewerIndex(index);
                    setJobImageViewerOpen(true);
                  }}
                >
                  <Image source={{ uri: image.url }} style={styles.jobImage} />
                </Pressable>
              ))}
            </ScrollView>
            <ImageViewerModal
              images={details.job.images.map((image) => ({ id: image.id, url: image.url }))}
              initialIndex={jobImageViewerIndex}
              visible={jobImageViewerOpen}
              onClose={() => setJobImageViewerOpen(false)}
            />
          </>
        ) : null}
        <Text style={[styles.meta, { color: theme.colors.text }]}>
          {serviceCategoryLabel(details.job.category)} / {serviceSubcategoryLabel(details.job.category, details.job.subcategory)}
        </Text>
        <View style={styles.badges}>
          <Badge status={details.job.status} />
          {details.job.status === 'CLOSED' ? <Badge status="JOB CLOSED" /> : null}
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
        <Card onPress={() => setEmployerInfoOpen(true)}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Employer</Text>
          <Text style={[styles.copy, { color: theme.colors.textMuted }]}>
            {details.employer.profile?.displayName ?? details.employer.email}
          </Text>
          <Text style={[styles.copy, { color: theme.colors.textMuted }]}>{details.employer.email}</Text>
          {details.employerRatingSummary?.totalReviews ? (
            <Text style={[styles.copy, { color: theme.colors.textMuted }]}>
              Employer rating {Number(details.employerRatingSummary.averageRating).toFixed(1)} ({details.employerRatingSummary.totalReviews})
            </Text>
          ) : null}
          <Text style={[styles.linkText, { color: theme.colors.success }]}>View employer info</Text>
        </Card>
      ) : details.employerRatingSummary?.totalReviews ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Employer rating</Text>
          <Text style={[styles.copy, { color: theme.colors.textMuted }]}>
            Anonymous employer rating {Number(details.employerRatingSummary.averageRating).toFixed(1)} ({details.employerRatingSummary.totalReviews})
          </Text>
        </Card>
      ) : null}

      {details.contractor?.portfolioImages?.length ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Portfolio</Text>
          <View style={styles.portfolio}>
            {details.contractor.portfolioImages.map((image, index) => (
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel={`Open portfolio image ${index + 1}`}
                key={image.id}
                onPress={() => {
                  setPortfolioViewerIndex(index);
                  setPortfolioViewerOpen(true);
                }}
              >
                <Image source={{ uri: image.url }} style={styles.portfolioImage} />
              </Pressable>
            ))}
          </View>
          <ImageViewerModal
            images={details.contractor.portfolioImages.map((image) => ({ id: image.id, url: image.url }))}
            initialIndex={portfolioViewerIndex}
            visible={portfolioViewerOpen}
            onClose={() => setPortfolioViewerOpen(false)}
          />
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
          <Button title="Mark Job Completed" icon={CheckCircle2} loading={completeMutation.isPending} onPress={markCompleted} style={styles.completeButton} />
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
        {canContractorReviewEmployer ? (
          <Button
            title="Review Employer"
            icon={Star}
            variant="secondary"
            onPress={() =>
              navigation.getParent()?.navigate('ActivityTab', {
                screen: 'LeaveReview',
                params: { contactId: details.contactUnlock?.id ?? '', target: 'employer' },
              })
            }
          />
        ) : null}
        {user?.role === 'CONTRACTOR' && employerReviewId ? (
          <Button
            title="View Employer Review"
            icon={Star}
            variant="secondary"
            onPress={() =>
              navigation.getParent()?.navigate('ActivityTab', {
                screen: 'ReviewDetails',
                params: { reviewId: employerReviewId, target: 'employer' },
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
  jobImages: {
    gap: 8,
  },
  jobImage: {
    width: 132,
    height: 96,
    borderRadius: 8,
  },
  copy: {
    fontSize: 14,
    lineHeight: 21,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '900',
  },
  employerModalAvatarWrap: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  employerModalAvatar: {
    borderRadius: 42,
    height: 84,
    width: 84,
  },
  employerModalAvatarFallback: {
    alignItems: 'center',
    borderRadius: 42,
    height: 84,
    justifyContent: 'center',
    width: 84,
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
  selectedNotice: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selectedBadge: {
    fontSize: 15,
    fontWeight: '900',
  },
  selectedText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  historyText: {
    fontSize: 13,
    fontWeight: '700',
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
  completeButton: {
    minHeight: 52,
  },
});
