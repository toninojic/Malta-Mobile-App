import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { ClipboardList, RefreshCw, Star } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useContactsReadyForReview } from '../../api/contactHooks';
import { useNotifications } from '../../api/notificationHooks';
import {
  useContractorRatingSummary,
  useContractorReviews,
  useEmployerRatingSummary,
  useEmployerReviews,
  useMyGivenReviews,
} from '../../api/reviewHooks';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { RatingSummaryCard } from '../../components/reviews/RatingSummaryCard';
import { ReviewCard } from '../../components/reviews/ReviewCard';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../design/theme';
import { ActivityStackParamList } from '../../navigation/types';
import { useActivityUiStore } from '../../store/activity.store';
import { useAuthStore } from '../../store/auth.store';
import { ContactUnlock, NotificationType } from '../../types/domain';

type Props = NativeStackScreenProps<ActivityStackParamList, 'MyReviews'>;
const REVIEW_ACTIVITY_TYPES = new Set<NotificationType>(['REVIEW_RECEIVED', 'REVIEW_REPLIED', 'REVIEW_REMOVED']);

export function MyReviewsScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const isFocused = useIsFocused();
  const user = useAuthStore((state) => state.user);
  const markReviewTasksViewed = useActivityUiStore((state) => state.markReviewTasksViewed);
  const markContractorActivitySectionViewed = useActivityUiStore((state) => state.markContractorActivitySectionViewed);
  const [tab, setTab] = useState<'received' | 'given' | 'toLeave'>(route.params?.initialTab ?? 'received');
  const isContractor = user?.role === 'CONTRACTOR';
  const contractorReviewsQuery = useContractorReviews(isContractor ? user?.id : undefined);
  const contractorSummaryQuery = useContractorRatingSummary(isContractor ? user?.id : undefined);
  const employerReviewsQuery = useEmployerReviews(user?.role === 'EMPLOYER' ? user?.id : undefined);
  const employerSummaryQuery = useEmployerRatingSummary(user?.role === 'EMPLOYER' ? user?.id : undefined);
  const givenReviewsQuery = useMyGivenReviews(user?.role === 'EMPLOYER' || user?.role === 'CONTRACTOR' ? user.id : undefined);
  const readyReviewsQuery = useContactsReadyForReview(user?.role === 'EMPLOYER' || user?.role === 'CONTRACTOR');
  const notificationsQuery = useNotifications(Boolean(isFocused && user && user.role !== 'ADMIN'), false);
  const reviewsQuery = isContractor ? contractorReviewsQuery : employerReviewsQuery;
  const summaryQuery = isContractor ? contractorSummaryQuery : employerSummaryQuery;
  const activeListQuery = tab === 'given' ? givenReviewsQuery : reviewsQuery;
  const activeReviewTarget =
    tab === 'given'
      ? isContractor
        ? 'employer'
        : 'contractor'
      : isContractor
        ? 'contractor'
        : 'employer';
  const reviewNotificationIds = useMemo(
    () =>
      (notificationsQuery.data?.data ?? [])
        .filter((notification) => !notification.isRead && REVIEW_ACTIVITY_TYPES.has(notification.type))
        .map((notification) => notification.id),
    [notificationsQuery.data?.data],
  );

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) {
        return;
      }

      void reviewsQuery.refetch({ cancelRefetch: false });
      void summaryQuery.refetch({ cancelRefetch: false });
      void givenReviewsQuery.refetch({ cancelRefetch: false });
      void readyReviewsQuery.refetch({ cancelRefetch: false });
    }, [givenReviewsQuery.refetch, readyReviewsQuery.refetch, reviewsQuery.refetch, summaryQuery.refetch, user?.id]),
  );

  useEffect(() => {
    if (!isFocused || !user?.id) {
      return;
    }

    if (readyReviewsQuery.data) {
      markReviewTasksViewed(user.id, readyReviewsQuery.data.pagination.total);
    }

    markContractorActivitySectionViewed(user.id, 'reviews', reviewNotificationIds);
  }, [
    isFocused,
    markContractorActivitySectionViewed,
    markReviewTasksViewed,
    readyReviewsQuery.data,
    reviewNotificationIds,
    user?.id,
  ]);

  return (
    <Screen refreshing={reviewsQuery.isRefetching || summaryQuery.isRefetching || givenReviewsQuery.isRefetching || readyReviewsQuery.isRefetching} onRefresh={() => {
      void reviewsQuery.refetch();
      void summaryQuery.refetch();
      void givenReviewsQuery.refetch();
      void readyReviewsQuery.refetch();
    }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>My reviews</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Ratings from confirmed completed jobs.</Text>
      </View>

      <View style={styles.tabs}>
        <ReviewTab
          label={`Received (${reviewsQuery.data?.pagination.total ?? 0})`}
          active={tab === 'received'}
          onPress={() => setTab('received')}
        />
        <ReviewTab
          label={`Given (${givenReviewsQuery.data?.pagination.total ?? 0})`}
          active={tab === 'given'}
          onPress={() => setTab('given')}
        />
        <ReviewTab
          label={`To Leave (${readyReviewsQuery.data?.pagination.total ?? 0})`}
          active={tab === 'toLeave'}
          onPress={() => setTab('toLeave')}
        />
      </View>

      {tab === 'received' ? <RatingSummaryCard summary={summaryQuery.data} /> : null}

      {tab !== 'toLeave' && activeListQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : null}

      {tab !== 'toLeave' && activeListQuery.error ? (
        <EmptyState
          icon={RefreshCw}
          title="Could not load reviews"
          message={activeListQuery.error instanceof Error ? activeListQuery.error.message : 'Please try again.'}
          actionTitle="Retry"
          onAction={() => void activeListQuery.refetch()}
        />
      ) : null}

      {tab !== 'toLeave' && activeListQuery.data?.data.length === 0 ? (
        <EmptyState
          icon={Star}
          title={tab === 'given' ? 'No given reviews yet' : 'No reviews yet'}
          message={
            tab === 'given'
              ? 'Reviews you have left after completed jobs will appear here.'
              : 'Completed job reviews will appear here.'
          }
        />
      ) : null}

      {tab !== 'toLeave' ? (
        <View style={styles.list}>
          {activeListQuery.data?.data.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onPress={() => navigation.navigate('ReviewDetails', { reviewId: review.id, target: activeReviewTarget })}
            />
          ))}
        </View>
      ) : (
        <View style={styles.list}>
          {readyReviewsQuery.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : null}
          {readyReviewsQuery.error ? (
            <EmptyState
              icon={RefreshCw}
              title="Could not load review tasks"
              message={readyReviewsQuery.error instanceof Error ? readyReviewsQuery.error.message : 'Please try again.'}
              actionTitle="Retry"
              onAction={() => void readyReviewsQuery.refetch()}
            />
          ) : null}
          {!readyReviewsQuery.isLoading && !readyReviewsQuery.error && readyReviewsQuery.data?.data.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No reviews to leave"
              message="Completed jobs waiting for your review will appear here."
            />
          ) : null}
          {readyReviewsQuery.data?.data.map((contact) => (
            <ReviewTaskCard
              key={contact.id}
              contact={contact}
              reviewerIsContractor={isContractor}
              onPress={() =>
                navigation.navigate('LeaveReview', {
                  contactId: contact.id,
                  target: isContractor ? 'employer' : 'contractor',
                })
              }
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function ReviewTaskCard({
  contact,
  reviewerIsContractor,
  onPress,
}: {
  contact: ContactUnlock;
  reviewerIsContractor: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const targetUser = reviewerIsContractor ? contact.employer : contact.contractor;
  const targetLabel = reviewerIsContractor ? 'employer' : 'contractor';

  return (
    <Card onPress={onPress}>
      <View style={styles.reviewTaskTop}>
        <View style={styles.reviewTaskCopy}>
          <Text style={[styles.reviewTaskTitle, { color: theme.colors.text }]}>{contact.jobRequest.title}</Text>
          <Text style={[styles.reviewTaskMeta, { color: theme.colors.textMuted }]}>
            Review {targetUser.profile?.displayName ?? targetUser.email}
          </Text>
        </View>
        <Badge status="READY TO REVIEW" />
      </View>
      <Text style={[styles.reviewTaskMeta, { color: theme.colors.textMuted }]}>
        Completed job / {targetLabel}
      </Text>
      <Button title="Leave Review" icon={Star} onPress={onPress} />
    </Card>
  );
}

function ReviewTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.tab,
        {
          backgroundColor: active ? theme.colors.success : theme.colors.surfaceMuted,
          borderColor: active ? theme.colors.success : theme.colors.border,
        },
      ]}
    >
      <Text style={[styles.tabText, { color: active ? '#FFFFFF' : theme.colors.text }]}>{label}</Text>
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
    paddingVertical: 24,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  list: {
    gap: 12,
  },
  reviewTaskTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  reviewTaskCopy: {
    flex: 1,
    gap: 4,
  },
  reviewTaskTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  reviewTaskMeta: {
    fontSize: 13,
    lineHeight: 19,
  },
});
