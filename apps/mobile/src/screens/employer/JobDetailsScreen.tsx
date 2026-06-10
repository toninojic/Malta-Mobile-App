import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { CalendarClock, CheckCircle2, Edit3, MapPin, MessageCircle, RefreshCw, SendHorizontal, ShieldCheck, Star, Trash2, UserRound, XCircle } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../../api/client';
import { cacheJob, cacheOffer, invalidateMarketplaceState } from '../../api/invalidation';
import { useEnsureConversationForContact } from '../../api/messageHooks';
import { useCompletionStatus, useConfirmCompletion } from '../../api/reviewHooks';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { ImageViewerModal } from '../../components/ImageViewerModal';
import { Screen } from '../../components/Screen';
import { serviceCategoryLabel, serviceSubcategoryLabel } from '../../config/serviceCategories';
import { useTheme } from '../../design/theme';
import { JobsStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/auth.store';
import { JobRequest, Offer } from '../../types/domain';
import { formatDate } from '../../utils/date';

type Props = NativeStackScreenProps<JobsStackParamList, 'JobDetails'>;

export function JobDetailsScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const jobId = route.params.jobId;
  const isContractor = user?.role === 'CONTRACTOR';
  const canManage = user?.role === 'EMPLOYER' || user?.role === 'ADMIN';
  const canSelectOffers = user?.role === 'EMPLOYER';
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  const query = useQuery({
    queryKey: ['jobs', jobId],
    queryFn: () => api.job(jobId),
    refetchOnWindowFocus: true,
  });

  const offersQuery = useQuery({
    queryKey: ['offers', 'job', jobId],
    queryFn: () => api.offersForJob(jobId, { limit: 50 }),
    enabled: canManage,
    refetchOnWindowFocus: true,
  });

  const myOffersQuery = useQuery({
    queryKey: ['offers', 'mine', jobId],
    queryFn: () => api.myOffers({ limit: 100 }),
    enabled: isContractor,
    refetchOnWindowFocus: true,
  });

  const myOffer = useMemo(
    () => myOffersQuery.data?.data.find((offer) => offer.jobRequestId === jobId),
    [jobId, myOffersQuery.data?.data],
  );

  useFocusEffect(
    useCallback(() => {
      void query.refetch({ cancelRefetch: false });
      if (canManage) {
        void offersQuery.refetch({ cancelRefetch: false });
      }
      if (isContractor) {
        void myOffersQuery.refetch({ cancelRefetch: false });
      }
    }, [
      canManage,
      isContractor,
      myOffersQuery.refetch,
      offersQuery.refetch,
      query.refetch,
    ]),
  );

  const renewMutation = useMutation({
    mutationFn: () => api.renewJob(jobId),
    onSuccess: async (job) => {
      cacheJob(queryClient, job);
      await invalidateMarketplaceState(queryClient, { jobId: job.id });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteJob(jobId),
    onSuccess: async (result) => {
      cacheJob(queryClient, result.job);
      await invalidateMarketplaceState(queryClient, { jobId: result.job.id });
      navigation.goBack();
    },
  });

  const selectOfferMutation = useMutation({
    mutationFn: api.selectOffer,
    onSuccess: async (offer) => {
      cacheOffer(queryClient, offer);
      queryClient.setQueryData<JobRequest>(['jobs', jobId], (job) => (job ? { ...job, status: 'IN_PROGRESS' } : job));
      await invalidateMarketplaceState(queryClient, {
        jobId,
        offerId: offer.id,
        contractorId: offer.contractorId,
      });
    },
    onError: (error) => {
      Alert.alert('Could not select offer', error instanceof Error ? error.message : 'Please try again.');
    },
  });
  const rejectOfferMutation = useMutation({
    mutationFn: api.rejectOffer,
    onSuccess: async (offer) => {
      cacheOffer(queryClient, offer);
      await invalidateMarketplaceState(queryClient, {
        jobId,
        offerId: offer.id,
        contractorId: offer.contractorId,
      });
    },
    onError: (error) => {
      Alert.alert('Could not reject offer', error instanceof Error ? error.message : 'Please try again.');
    },
  });
  const cancelSelectionMutation = useMutation({
    mutationFn: api.cancelOfferSelection,
    onSuccess: async (offer) => {
      cacheOffer(queryClient, offer);
      queryClient.setQueryData<JobRequest>(['jobs', jobId], (currentJob) =>
        currentJob ? { ...currentJob, status: 'ACTIVE' } : currentJob,
      );
      await invalidateMarketplaceState(queryClient, {
        jobId,
        offerId: offer.id,
        contractorId: offer.contractorId,
      });
    },
    onError: (error) => {
      Alert.alert('Could not cancel selection', error instanceof Error ? error.message : 'Please try again.');
    },
  });

  const ensureConversationMutation = useEnsureConversationForContact();

  const confirmDelete = () => {
    Alert.alert('Close job request', 'This will close the request and remove it from contractor browsing.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  };

  const confirmSelectOffer = (offer: Offer) => {
    Alert.alert(
      'Selecting an offer',
      'When you select an offer, this job will no longer be visible to other contractors. The selected contractor will be notified and can unlock contact by spending 1 token.\n\nIf the selected contractor does not respond, you can cancel the selection and make the job available again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Select Offer',
          onPress: () => selectOfferMutation.mutate(offer.id),
        },
      ],
    );
  };

  const confirmRejectOffer = (offer: Offer) => {
    Alert.alert('Reject offer', 'Reject this contractor offer?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: () => rejectOfferMutation.mutate(offer.id),
      },
    ]);
  };

  const confirmCancelSelection = (offer: Offer) => {
    Alert.alert('Cancel selection', 'This will reject the selected offer and make the job available to contractors again.', [
      { text: 'Keep selected', style: 'cancel' },
      {
        text: 'Cancel Selection',
        style: 'destructive',
        onPress: () => cancelSelectionMutation.mutate(offer.id),
      },
    ]);
  };

  if (query.isLoading) {
    return (
      <Screen>
        <EmptyState icon={RefreshCw} title="Loading job" message="Fetching the latest details." />
      </Screen>
    );
  }

  if (query.error || !query.data) {
    return (
      <Screen>
        <EmptyState
          icon={RefreshCw}
          title="Could not load job"
          message={query.error instanceof Error ? query.error.message : 'Please try again.'}
          actionTitle="Retry"
          onAction={() => void query.refetch()}
        />
      </Screen>
    );
  }

  const job = query.data;
  const expiresAt = formatDate(job.expiresAt);

  return (
    <Screen>
      {job.images.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.images}>
          {job.images.map((image, index) => (
            <Pressable
              accessibilityRole="imagebutton"
              accessibilityLabel={`Open job image ${index + 1}`}
              key={image.id}
              onPress={() => {
                setViewerIndex(index);
                setViewerOpen(true);
              }}
            >
              <Image source={{ uri: image.url }} style={styles.image} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <ImageViewerModal
        images={job.images.map((image) => ({ id: image.id, url: image.url }))}
        initialIndex={viewerIndex}
        visible={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />

      <Card>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{job.title}</Text>
          <Badge status={job.status} />
        </View>
        <Text style={[styles.description, { color: theme.colors.textMuted }]}>{job.description}</Text>
        <View style={styles.metaRow}>
          <MapPin color={theme.colors.textMuted} size={16} />
          <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>{job.location}</Text>
        </View>
        <View style={styles.metaRow}>
          <CalendarClock color={theme.colors.textMuted} size={16} />
          <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>Expires {expiresAt}</Text>
        </View>
        <Text style={[styles.category, { color: theme.colors.text }]}>
          {serviceCategoryLabel(job.category)} / {serviceSubcategoryLabel(job.category, job.subcategory)}
        </Text>
      </Card>

      {canManage ? (
        <View style={styles.actions}>
          <Button title="Edit" icon={Edit3} variant="secondary" onPress={() => navigation.navigate('JobForm', { jobId })} />
          <Button
            title="Renew"
            icon={RefreshCw}
            variant="secondary"
            loading={renewMutation.isPending}
            onPress={() => renewMutation.mutate()}
          />
          <Button
            title="Close"
            icon={Trash2}
            variant="danger"
            loading={deleteMutation.isPending}
            onPress={confirmDelete}
          />
        </View>
      ) : null}

      {isContractor ? (
        <Card>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Your offer</Text>
            {myOffer ? <Badge status={myOffer.status} /> : null}
          </View>
          {myOffersQuery.isLoading ? (
            <Text style={[styles.emptyCopy, { color: theme.colors.textMuted }]}>Loading your offer...</Text>
          ) : myOffer ? (
            <>
              <Text style={[styles.offerPrice, { color: theme.colors.text }]}>
                EUR {myOffer.estimatedPrice} / {myOffer.estimatedCompletionDays} days
              </Text>
              {myOffer.message ? (
                <Text numberOfLines={3} style={[styles.description, { color: theme.colors.textMuted }]}>
                  {myOffer.message}
                </Text>
              ) : null}
              <Button
                title={myOffer.status === 'SELECTED' && myOffer.unlockStatus !== 'UNLOCKED' ? 'Open Work Details / Unlock Contact' : 'Open Work Details'}
                icon={MessageCircle}
                onPress={() => navigation.navigate('OfferWorkDetails', { offerId: myOffer.id })}
              />
              {myOffer.employer ? (
                <View style={[styles.unframedContact, { borderColor: theme.colors.border }]}>
                  <Text style={[styles.offerTitle, { color: theme.colors.text }]}>
                    {myOffer.employer.profile?.displayName ?? myOffer.employer.email}
                  </Text>
                  <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>{myOffer.employer.email}</Text>
                  {myOffer.employer.profile?.phone ? (
                    <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>{myOffer.employer.profile.phone}</Text>
                  ) : null}
                </View>
              ) : null}
            </>
          ) : (
            <Button title="Submit Offer" icon={SendHorizontal} onPress={() => navigation.navigate('OfferForm', { jobId })} />
          )}
        </Card>
      ) : null}

      {canManage ? (
        <View style={styles.offersSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Offers</Text>
            <Text style={[styles.sectionCount, { color: theme.colors.textMuted }]}>
              {offersQuery.data?.pagination.total ?? 0}
            </Text>
          </View>
          {offersQuery.error ? (
            <EmptyState
              icon={RefreshCw}
              title="Could not load offers"
              message={offersQuery.error instanceof Error ? offersQuery.error.message : 'Please try again.'}
              actionTitle="Retry"
              onAction={() => void offersQuery.refetch()}
            />
          ) : null}
          {offersQuery.data?.data.length === 0 ? (
            <Text style={[styles.emptyCopy, { color: theme.colors.textMuted }]}>No offers yet.</Text>
          ) : null}
          {offersQuery.data?.data.map((offer) => (
            <EmployerOfferCard
              key={offer.id}
              offer={offer}
              canSelect={canSelectOffers}
              selecting={selectOfferMutation.isPending && offer.status === 'PENDING'}
              rejecting={rejectOfferMutation.isPending}
              cancellingSelection={cancelSelectionMutation.isPending}
              onSelect={() => confirmSelectOffer(offer)}
              onReject={() => confirmRejectOffer(offer)}
              onCancelSelection={() => confirmCancelSelection(offer)}
              onStatusChange={() => {
                void query.refetch({ cancelRefetch: false });
                void offersQuery.refetch({ cancelRefetch: false });
              }}
              onLeaveReview={(contactId) =>
                navigation.getParent()?.navigate('ActivityTab', { screen: 'LeaveReview', params: { contactId } })
              }
              onViewReview={(reviewId) =>
                navigation.getParent()?.navigate('ActivityTab', { screen: 'ReviewDetails', params: { reviewId } })
              }
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
              onOpenProfile={
                offer.unlockStatus === 'UNLOCKED' && offer.contractor?.id
                  ? () =>
                      navigation
                        .getParent()
                        ?.navigate('ActivityTab', { screen: 'ContractorProfile', params: { contractorId: offer.contractor?.id as string } })
                  : undefined
              }
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function EmployerOfferCard({
  offer,
  canSelect,
  selecting,
  rejecting,
  cancellingSelection,
  onSelect,
  onReject,
  onCancelSelection,
  onStatusChange,
  onLeaveReview,
  onViewReview,
  onOpenChat,
  onOpenProfile,
}: {
  offer: Offer;
  canSelect: boolean;
  selecting: boolean;
  rejecting: boolean;
  cancellingSelection: boolean;
  onSelect: () => void;
  onReject: () => void;
  onCancelSelection: () => void;
  onStatusChange: () => void;
  onLeaveReview: (contactId: string) => void;
  onViewReview: (reviewId: string) => void;
  onOpenChat?: () => void;
  onOpenProfile?: () => void;
}) {
  const theme = useTheme();
  const isSelected = offer.status === 'SELECTED' && offer.selectedByEmployer;
  const isUnlocked = offer.unlockStatus === 'UNLOCKED';
  const hasPendingUnlock = offer.unlockStatus === 'PENDING';
  const canRejectOffer = canSelect && offer.status === 'PENDING';
  const canCancelSelection = canSelect && offer.status === 'SELECTED' && !isUnlocked;
  const [portfolioViewerIndex, setPortfolioViewerIndex] = useState(0);
  const [portfolioViewerOpen, setPortfolioViewerOpen] = useState(false);
  const portfolioImages = offer.portfolioImages ?? [];

  return (
    <Card>
      <View style={styles.offerTop}>
        <View style={styles.offerIdentity}>
          <Text style={[styles.offerTitle, { color: theme.colors.text }]}>
            {isUnlocked ? (offer.contractor?.profile?.displayName ?? offer.contractor?.email ?? 'Contractor') : 'Anonymous contractor'}
          </Text>
          <View style={styles.ratingRow}>
            <Star color={theme.colors.warning} size={16} />
            <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>
              {offer.rating ? offer.rating.toFixed(1) : 'New'} ({offer.totalReviews ?? 0})
            </Text>
            {offer.verificationStatus === 'VERIFIED' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Verified contractor information"
                onPress={showVerifiedContractorInfo}
                hitSlop={8}
              >
                <ShieldCheck color={theme.colors.success} size={16} />
              </Pressable>
            ) : null}
          </View>
        </View>
        <Badge status={offer.status} />
      </View>
      <Text style={[styles.offerPrice, { color: theme.colors.text }]}>
        EUR {offer.estimatedPrice} / {offer.estimatedCompletionDays} days
      </Text>
      {offer.message ? (
        <Text numberOfLines={3} style={[styles.description, { color: theme.colors.textMuted }]}>
          {offer.message}
        </Text>
      ) : null}
      {portfolioImages.length ? (
        <View style={styles.portfolioPreview}>
          {portfolioImages.slice(0, 3).map((image, index) => (
            <Pressable
              accessibilityRole="imagebutton"
              accessibilityLabel={`Open portfolio image ${index + 1}`}
              key={image.id}
              onPress={() => {
                setPortfolioViewerIndex(index);
                setPortfolioViewerOpen(true);
              }}
            >
              <Image source={{ uri: image.url }} style={styles.portfolioThumb} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <ImageViewerModal
        images={portfolioImages.map((image) => ({ id: image.id, url: image.url }))}
        initialIndex={portfolioViewerIndex}
        visible={portfolioViewerOpen}
        onClose={() => setPortfolioViewerOpen(false)}
      />
      {isUnlocked && offer.contractor ? (
        <View style={styles.contactInfo}>
          <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>{offer.contractor.email}</Text>
          {offer.contractor.profile?.phone ? (
            <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>{offer.contractor.profile.phone}</Text>
          ) : null}
          {offer.contractor.profile?.companyName ? (
            <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>{offer.contractor.profile.companyName}</Text>
          ) : null}
        </View>
      ) : null}
      {canSelect && offer.status === 'PENDING' ? (
        <Button
          title="Select Offer"
          icon={CheckCircle2}
          loading={selecting}
          onPress={onSelect}
        />
      ) : null}
      {canSelect && isSelected ? (
        <Button
          title="Selected"
          icon={CheckCircle2}
          variant="secondary"
          disabled
          onPress={onSelect}
        />
      ) : null}
      {canRejectOffer ? (
        <Button title="Reject Offer" icon={XCircle} variant="secondary" loading={rejecting} onPress={onReject} />
      ) : null}
      {canCancelSelection ? (
        <View style={[styles.selectionInfo, { borderColor: theme.colors.border }]}>
          <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>
            If the selected contractor does not respond, you can cancel the selection and make the job available again.
          </Text>
          <Button
            title="Cancel Selection"
            icon={XCircle}
            variant="secondary"
            loading={cancellingSelection}
            onPress={onCancelSelection}
          />
        </View>
      ) : null}
      {canSelect && isSelected && hasPendingUnlock && !isUnlocked ? <Badge status="LOCKED" /> : null}
      <EmployerOfferCompletionActions
        offer={offer}
        onStatusChange={onStatusChange}
        onLeaveReview={onLeaveReview}
        onViewReview={onViewReview}
      />
      {isUnlocked && onOpenChat ? (
        <Button title="Open Chat" icon={MessageCircle} onPress={onOpenChat} />
      ) : null}
      {isUnlocked && onOpenProfile ? (
        <Button title="View Contractor Profile" icon={UserRound} variant="secondary" onPress={onOpenProfile} />
      ) : null}
    </Card>
  );
}

function showVerifiedContractorInfo() {
  Alert.alert(
    'Verified Contractor',
    'This contractor has submitted verification documents that were reviewed and approved by the MaltaPro admin team.',
  );
}

function EmployerOfferCompletionActions({
  offer,
  onStatusChange,
  onLeaveReview,
  onViewReview,
}: {
  offer: Offer;
  onStatusChange: () => void;
  onLeaveReview: (contactId: string) => void;
  onViewReview: (reviewId: string) => void;
}) {
  const contactId = offer.unlockStatus === 'UNLOCKED' ? offer.contactId ?? undefined : undefined;
  const completionQuery = useCompletionStatus(contactId);
  const confirmMutation = useConfirmCompletion();
  const completion = completionQuery.data;
  const status = completion?.status ?? offer.completionStatus ?? null;
  const canReview = Boolean(completion?.canReview && !completion.review);
  const reviewId = completion?.review?.id;

  if (!contactId) {
    return null;
  }

  const confirmCompletion = () => {
    confirmMutation.mutate(contactId, {
      onSuccess: async () => {
        await completionQuery.refetch({ cancelRefetch: false });
        onStatusChange();
        Alert.alert('Completion confirmed', 'Review is now available.');
      },
      onError: (error) => {
        Alert.alert('Could not confirm completion', error instanceof Error ? error.message : 'Please try again.');
      },
    });
  };

  return (
    <View style={styles.completionActions}>
      {status ? <Badge status={status} /> : null}
      {status === 'PENDING_EMPLOYER_CONFIRMATION' ? (
        <Button
          title="Confirm Completion"
          icon={CheckCircle2}
          loading={confirmMutation.isPending}
          onPress={confirmCompletion}
        />
      ) : null}
      {canReview ? (
        <Button title="Leave Review" icon={Star} variant="secondary" onPress={() => onLeaveReview(contactId)} />
      ) : null}
      {reviewId ? (
        <Button title="View Review" icon={Star} variant="secondary" onPress={() => onViewReview(reviewId)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  images: {
    gap: 12,
  },
  image: {
    width: 240,
    height: 160,
    borderRadius: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: '900',
  },
  description: {
    fontSize: 15,
    lineHeight: 23,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 14,
  },
  category: {
    fontSize: 14,
    fontWeight: '800',
  },
  actions: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '800',
  },
  offersSection: {
    gap: 12,
  },
  offerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  offerIdentity: {
    flex: 1,
    gap: 6,
  },
  offerTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  offerPrice: {
    fontSize: 18,
    fontWeight: '900',
  },
  emptyCopy: {
    fontSize: 14,
  },
  contactInfo: {
    gap: 4,
  },
  completionActions: {
    gap: 8,
  },
  selectionInfo: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
    paddingTop: 10,
  },
  portfolioPreview: {
    flexDirection: 'row',
    gap: 8,
  },
  portfolioThumb: {
    width: 72,
    height: 58,
    borderRadius: 8,
  },
  unframedContact: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
    paddingTop: 12,
  },
});
