import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BriefcaseBusiness, ClipboardList, Star, TimerReset } from 'lucide-react-native';
import { ComponentType, useCallback, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useActivitySummary } from '../../api/activityHooks';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../design/theme';
import { ActivityStackParamList } from '../../navigation/types';
import { useActivityUiStore } from '../../store/activity.store';
import { useAuthStore } from '../../store/auth.store';

type Props = NativeStackScreenProps<ActivityStackParamList, 'ActivityHome'>;

export function ActivityScreen({ navigation }: Props) {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const isContractor = user?.role === 'CONTRACTOR';
  const isAdmin = user?.role === 'ADMIN';
  const isFocused = useIsFocused();
  const summaryQuery = useActivitySummary(Boolean(user), isFocused);
  const markContractorActivityViewed = useActivityUiStore((state) => state.markContractorActivityViewed);

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
          <ActivityCard title="My Offers" icon={ClipboardList} count={summary?.role === 'CONTRACTOR' ? summary.myOffersCount : 0} onPress={() => navigation.getParent()?.navigate('JobsTab', { screen: 'MyOffers', params: { mode: 'activity' } })} />
          <ActivityCard title="My Reviews" icon={Star} count={summary?.role === 'CONTRACTOR' ? summary.myReviewsCount : 0} onPress={() => navigation.navigate('MyReviews')} />
        </>
      ) : (
        <>
          <ActivityCard title={isAdmin ? 'All Jobs' : 'My Jobs'} icon={BriefcaseBusiness} count={summary?.role !== 'CONTRACTOR' ? summary?.myJobsCount ?? 0 : 0} onPress={() => navigation.getParent()?.navigate('JobsTab', { screen: 'EmployerJobs' })} />
          <ActivityCard title="Reviews" icon={Star} count={summary?.role !== 'CONTRACTOR' ? summary?.reviewsToLeaveCount ?? 0 : 0} onPress={() => navigation.navigate('Contacts', { filter: 'completed' })} />
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
  onPress,
}: {
  title: string;
  icon: ComponentType<{ color?: string; size?: number }>;
  count: number;
  badge?: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Card onPress={onPress}>
      <View style={styles.cardRow}>
        <Icon color={theme.colors.primary} size={22} />
        <View style={styles.cardCopy}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{title}</Text>
          <Text style={[styles.count, { color: theme.colors.textMuted }]}>{count} item{count === 1 ? '' : 's'}</Text>
        </View>
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
});
