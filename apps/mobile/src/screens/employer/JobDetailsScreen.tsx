import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CalendarClock, CheckCircle2, Edit3, LockOpen, MapPin, MessageCircle, RefreshCw, SendHorizontal, Star, Trash2 } from 'lucide-react-native';
import { useMemo } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../../api/client';
import { useEnsureConversationForContact } from '../../api/messageHooks';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { serviceCategoryLabel, serviceSubcategoryLabel } from '../../config/serviceCategories';
import { useTheme } from '../../design/theme';
import { JobsStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/auth.store';
import { Offer } from '../../types/domain';

type Props = NativeStackScreenProps<JobsStackParamList, 'JobDetails'>;

export function JobDetailsScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const jobId = route.params.jobId;
  const isContractor = user?.role === 'CONTRACTOR';
  const canManage = user?.role === 'EMPLOYER' || user?.role === 'ADMIN';
  const canSelectOffers = user?.role === 'EMPLOYER';

  const query = useQuery({
    queryKey: ['jobs', jobId],
    queryFn: () => api.job(jobId),
  });

  const offersQuery = useQuery({
    queryKey: ['offers', 'job', jobId],
    queryFn: () => api.offersForJob(jobId, { limit: 50 }),
    enabled: canManage,
  });

  const myOffersQuery = useQuery({
    queryKey: ['offers', 'mine', jobId],
    queryFn: () => api.myOffers({ limit: 100 }),
    enabled: isContractor,
  });

  const myOffer = useMemo(
    () => myOffersQuery.data?.data.find((offer) => offer.jobRequestId === jobId),
    [jobId, myOffersQuery.data?.data],
  );

  const renewMutation = useMutation({
    mutationFn: () => api.renewJob(jobId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteJob(jobId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      navigation.goBack();
    },
  });

  const selectOfferMutation = useMutation({
    mutationFn: api.selectOffer,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['offers', 'job', jobId] }),
        queryClient.invalidateQueries({ queryKey: ['jobs'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
    },
    onError: (error) => {
      Alert.alert('Could not select offer', error instanceof Error ? error.message : 'Please try again.');
    },
  });

  const ensureConversationMutation = useEnsureConversationForContact();

  const withdrawOfferMutation = useMutation({
    mutationFn: api.withdrawOffer,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['offers'] });
      await queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: (error) => {
      Alert.alert('Could not withdraw offer', error instanceof Error ? error.message : 'Please try again.');
    },
  });

  const confirmDelete = () => {
    Alert.alert('Close job request', 'This will close the request and remove it from contractor browsing.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  };

  const confirmWithdraw = (offerId: string) => {
    Alert.alert('Withdraw offer', 'This offer will no longer appear to the employer.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Withdraw', style: 'destructive', onPress: () => withdrawOfferMutation.mutate(offerId) },
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
  const expiresAt = new Date(job.expiresAt).toLocaleDateString();

  return (
    <Screen>
      {job.images.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.images}>
          {job.images.map((image) => (
            <Image key={image.id} source={{ uri: image.url }} style={styles.image} />
          ))}
        </ScrollView>
      ) : null}

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
              <View style={styles.actions}>
                  <Button
                  title="Edit Offer"
                  icon={Edit3}
                  variant="secondary"
                  disabled={myOffer.status === 'WITHDRAWN'}
                  onPress={() => navigation.navigate('OfferForm', { jobId, offerId: myOffer.id })}
                />
                <Button
                  title={myOffer.unlockStatus === 'UNLOCKED' ? 'Unlocked' : 'Unlock Contact - 1 token'}
                  icon={LockOpen}
                  variant="secondary"
                  disabled={myOffer.status !== 'SELECTED' || myOffer.unlockStatus === 'UNLOCKED'}
                  onPress={() => navigation.navigate('UnlockContact', { offerId: myOffer.id })}
                />
                <Button
                  title="Withdraw"
                  icon={Trash2}
                  variant="danger"
                  disabled={myOffer.status === 'WITHDRAWN'}
                  loading={withdrawOfferMutation.isPending}
                  onPress={() => confirmWithdraw(myOffer.id)}
                />
              </View>
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
              selecting={selectOfferMutation.isPending}
              onSelect={() => selectOfferMutation.mutate(offer.id)}
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
  onSelect,
  onOpenChat,
}: {
  offer: Offer;
  canSelect: boolean;
  selecting: boolean;
  onSelect: () => void;
  onOpenChat?: () => void;
}) {
  const theme = useTheme();
  const isSelected = offer.status === 'SELECTED' || offer.selectedByEmployer;
  const isUnlocked = offer.unlockStatus === 'UNLOCKED';
  const isPending = offer.unlockStatus === 'PENDING';

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
      {canSelect ? (
        <Button
          title={isSelected ? 'Selected' : 'Select Offer'}
          icon={CheckCircle2}
          variant={isSelected ? 'secondary' : 'primary'}
          disabled={isSelected}
          loading={selecting && !isSelected}
          onPress={onSelect}
        />
      ) : null}
      {canSelect && isPending && !isUnlocked ? <Badge status="LOCKED" /> : null}
      {isUnlocked && onOpenChat ? (
        <Button title="Open Chat" icon={MessageCircle} onPress={onOpenChat} />
      ) : null}
    </Card>
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
  unframedContact: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
    paddingTop: 12,
  },
});
