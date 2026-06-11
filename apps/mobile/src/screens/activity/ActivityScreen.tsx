import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BriefcaseBusiness, ClipboardList, Star, TimerReset, WalletCards } from 'lucide-react-native';
import { ComponentType, useCallback, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useActivitySummary } from '../../api/activityHooks';
import { useNotifications } from '../../api/notificationHooks';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../design/theme';
import { ActivityStackParamList } from '../../navigation/types';
import { useActivityUiStore } from '../../store/activity.store';
import { useAuthStore } from '../../store/auth.store';
import { NotificationType } from '../../types/domain';

type Props = NativeStackScreenProps<ActivityStackParamList, 'ActivityHome'>;

const OFFER_ACTIVITY_TYPES = new Set<NotificationType>(['NEW_OFFER', 'OFFER_SELECTED', 'CONTACT_UNLOCKED', 'JOB_COMPLETED']);
const REVIEW_ACTIVITY_TYPES = new Set<NotificationType>(['REVIEW_RECEIVED', 'REVIEW_REPLIED', 'REVIEW_REMOVED']);
const EMPLOYER_REVIEW_ACTIVITY_TYPES = new Set<NotificationType>(['REVIEW_RECEIVED', 'REVIEW_REPLIED']);

export function ActivityScreen({ navigation }: Props) {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const isContractor = user?.role === 'CONTRACTOR';
  const isAdmin = user?.role === 'ADMIN';
  const isFocused = useIsFocused();
  const summaryQuery = useActivitySummary(Boolean(user), isFocused);
  const notificationsQuery = useNotifications(Boolean(user && !isAdmin), false);
  const markContractorActivityViewed = useActivityUiStore((state) => state.markContractorActivityViewed);
  const viewedReviewTaskCount = useActivityUiStore((state) =>
    user?.id ? state.viewedReviewTaskCounts[user.id] ?? 0 : 0,
  );
  const viewedSectionNotificationIds = useActivityUiStore((state) =>
    user?.id ? state.viewedContractorSectionNotificationIds[user.id] : undefined,
  );
  const markContractorActivitySectionViewed = useActivityUiStore((state) => state.markContractorActivitySectionViewed);
  const markReviewTasksViewed = useActivityUiStore((state) => state.markReviewTasksViewed);

  const forceRefreshActivity = useCallback(() => {
    if (!summaryQuery.isFetching) {
      void summaryQuery.refetch();
    }
  }, [summaryQuery.isFetching, summaryQuery.refetch]);

  useFocusEffect(
    useCallback(() => {
      const fetchedRecently = Date.now() - summaryQuery.dataUpdatedAt < 30_000;
      if (!summaryQuery.isFetching && !fetchedRecently) {
        void summaryQuery.refetch({ cancelRefetch: false });
      }
    }, [summaryQuery.dataUpdatedAt, summaryQuery.isFetching, summaryQuery.refetch]),
  );

  const summary = summaryQuery.data;
  const contractorActionableCount =
    summary?.role === 'CONTRACTOR' ? summary.selectedOffersCount + summary.jobsInProgressCount : 0;
  const unreadNotifications = notificationsQuery.data?.data.filter((notification) => !notification.isRead) ?? [];
  const offerNotifications = unreadNotifications.filter((notification) => OFFER_ACTIVITY_TYPES.has(notification.type));
  const reviewNotifications = unreadNotifications.filter((notification) => REVIEW_ACTIVITY_TYPES.has(notification.type));
  const employerReviewNotificationCount = unreadNotifications.filter((notification) =>
    EMPLOYER_REVIEW_ACTIVITY_TYPES.has(notification.type),
  );
  const viewedOfferIds = new Set(viewedSectionNotificationIds?.offers ?? []);
  const viewedReviewIds = new Set(viewedSectionNotificationIds?.reviews ?? []);
  const offerBadgeCount = offerNotifications.filter((notification) => !viewedOfferIds.has(notification.id)).length;
  const reviewBadgeCount = reviewNotifications.filter((notification) => !viewedReviewIds.has(notification.id)).length;
  const employerReviewNotificationBadgeCount = employerReviewNotificationCount.filter((notification) => !viewedReviewIds.has(notification.id)).length;
  const employerReviewTaskBadgeCount =
    summary?.role !== 'CONTRACTOR' ? Math.max((summary?.reviewsToLeaveCount ?? 0) - viewedReviewTaskCount, 0) : 0;

  const openContractorOffers = () => {
    if (user?.id) {
      markContractorActivitySectionViewed(user.id, 'offers', offerNotifications.map((notification) => notification.id));
    }

    navigation.getParent()?.navigate('JobsTab', { screen: 'MyOffers', params: { mode: 'activity' } });
  };

  const openContractorReviews = () => {
    if (user?.id) {
      markContractorActivitySectionViewed(user.id, 'reviews', reviewNotifications.map((notification) => notification.id));
    }

    navigation.navigate('MyReviews');
  };

  const openEmployerReviews = () => {
    if (user?.id && summary?.role !== 'CONTRACTOR') {
      markReviewTasksViewed(user.id, summary?.reviewsToLeaveCount ?? 0);
      markContractorActivitySectionViewed(user.id, 'reviews', employerReviewNotificationCount.map((notification) => notification.id));
    }

    navigation.navigate('MyReviews', {
      initialTab: summary?.role !== 'CONTRACTOR' && summary?.reviewsToLeaveCount ? 'toLeave' : 'received',
    });
  };

  useEffect(() => {
    if (isFocused && user?.role === 'CONTRACTOR' && user.id && summary?.role === 'CONTRACTOR') {
      markContractorActivityViewed(user.id, contractorActionableCount);
    }
  }, [contractorActionableCount, isFocused, markContractorActivityViewed, summary?.role, user?.id, user?.role]);

  const isLoading = summaryQuery.isLoading;
  const isRefreshing = summaryQuery.isRefetching;
  const firstError = summaryQuery.error;

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen refreshing={isRefreshing} onRefresh={forceRefreshActivity}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Activity</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          {isContractor ? 'Offers, selected work, unlocked contacts, and reviews.' : 'Jobs, received offers, confirmations, contacts, and reviews.'}
        </Text>
      </View>

      {firstError && !summary ? (
        <EmptyState
          icon={TimerReset}
          title="Could not refresh activity"
          message={firstError instanceof Error ? firstError.message : 'Please try again.'}
          actionTitle="Retry"
          onAction={forceRefreshActivity}
        />
      ) : null}

      {isContractor ? (
        <>
          <ActivityCard title="My Offers" icon={ClipboardList} count={summary?.role === 'CONTRACTOR' ? summary.myOffersCount : 0} badgeCount={offerBadgeCount} onPress={openContractorOffers} />
          <ActivityCard title="My Reviews" icon={Star} count={summary?.role === 'CONTRACTOR' ? summary.myReviewsCount : 0} badgeCount={reviewBadgeCount} onPress={openContractorReviews} />
          <ActivityCard title="Wallet" icon={WalletCards} count={0} countLabel="Token balance and purchases" badge="TOKENS" onPress={() => navigation.navigate('WalletHome')} />
        </>
      ) : (
        <>
          <ActivityCard title={isAdmin ? 'All Jobs' : 'My Jobs'} icon={BriefcaseBusiness} count={summary?.role !== 'CONTRACTOR' ? summary?.myJobsCount ?? 0 : 0} onPress={() => navigation.getParent()?.navigate('JobsTab', { screen: 'EmployerJobs' })} />
          <ActivityCard
            title="My Reviews"
            icon={Star}
            count={summary?.role !== 'CONTRACTOR' ? summary?.reviewsToLeaveCount ?? 0 : 0}
            badgeCount={summary?.role !== 'CONTRACTOR' ? employerReviewTaskBadgeCount + employerReviewNotificationBadgeCount : 0}
            onPress={openEmployerReviews}
          />
        </>
      )}
    </Screen>
  );
}

function ActivityCard({
  title,
  icon: Icon,
  count,
  badge,
  badgeCount = 0,
  countLabel,
  onPress,
}: {
  title: string;
  icon: ComponentType<{ color?: string; size?: number }>;
  count: number;
  badge?: string;
  badgeCount?: number;
  countLabel?: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Card onPress={onPress}>
      <View style={styles.cardRow}>
        <Icon color={theme.colors.primary} size={22} />
        <View style={styles.cardCopy}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{title}</Text>
          <Text style={[styles.count, { color: theme.colors.textMuted }]}>
            {countLabel ?? `${count} item${count === 1 ? '' : 's'}`}
          </Text>
        </View>
        {badgeCount > 0 ? (
          <View style={[styles.notificationBadge, { backgroundColor: theme.colors.danger }]}>
            <Text style={styles.notificationBadgeText}>{badgeCount}</Text>
          </View>
        ) : null}
        {badge ? <Badge status={badge} /> : null}
      </View>
      <Button title="Open" variant="secondary" onPress={onPress} />
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
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardCopy: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  count: {
    fontSize: 13,
  },
  notificationBadge: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
});
