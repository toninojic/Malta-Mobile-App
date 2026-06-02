import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Bell, BriefcaseBusiness, CheckCircle2, ClipboardList, Star, TimerReset, UsersRound } from 'lucide-react-native';
import { ComponentType, useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useActivitySummary } from '../../api/activityHooks';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../design/theme';
import { ActivityStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/auth.store';

type Props = NativeStackScreenProps<ActivityStackParamList, 'ActivityHome'>;

export function ActivityScreen({ navigation }: Props) {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const isContractor = user?.role === 'CONTRACTOR';
  const isAdmin = user?.role === 'ADMIN';
  const isFocused = useIsFocused();
  const summaryQuery = useActivitySummary(Boolean(user), isFocused);

  const forceRefreshActivity = useCallback(() => {
    if (!summaryQuery.isFetching) {
      void summaryQuery.refetch();
    }
  }, [summaryQuery.isFetching, summaryQuery.refetch]);

  useFocusEffect(
    useCallback(() => {
      void summaryQuery.refetch({ cancelRefetch: false });
    }, [summaryQuery.refetch]),
  );

  const summary = summaryQuery.data;
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
          <ActivityCard title="My Offers" icon={ClipboardList} count={summary?.role === 'CONTRACTOR' ? summary.myOffersCount : 0} onPress={() => navigation.getParent()?.navigate('JobsTab', { screen: 'MyOffers', params: { view: 'all' } })} />
          <ActivityCard title="Selected Offers" icon={CheckCircle2} count={summary?.role === 'CONTRACTOR' ? summary.selectedOffersCount : 0} badge={summary?.role === 'CONTRACTOR' && summary.selectedOffersCount ? 'Unlock Contact' : undefined} onPress={() => navigation.getParent()?.navigate('JobsTab', { screen: 'MyOffers', params: { view: 'selected' } })} />
          <ActivityCard title="Unlocked Contacts" icon={UsersRound} count={summary?.role === 'CONTRACTOR' ? summary.unlockedContactsCount : 0} onPress={() => navigation.navigate('Contacts', { filter: 'all' })} />
          <ActivityCard
            title="Jobs In Progress"
            icon={BriefcaseBusiness}
            count={summary?.role === 'CONTRACTOR' ? summary.jobsInProgressCount : 0}
            badge={summary?.role === 'CONTRACTOR' && summary.jobsInProgressCount ? 'IN_PROGRESS' : undefined}
            onPress={() =>
              navigation.navigate('Contacts', {
                filter: 'in_progress',
                emptyTitle: 'No jobs in progress yet',
                emptyMessage: 'Unlocked and active jobs will appear here.',
              })
            }
          />
          <ActivityCard
            title="Completed Jobs"
            icon={CheckCircle2}
            count={summary?.role === 'CONTRACTOR' ? summary.completedJobsCount : 0}
            badge={summary?.role === 'CONTRACTOR' && summary.completedJobsCount ? 'COMPLETED' : undefined}
            onPress={() =>
              navigation.navigate('Contacts', {
                filter: 'completed',
                emptyTitle: 'No completed jobs yet',
                emptyMessage: 'Completed unlocked jobs will appear here.',
              })
            }
          />
          <ActivityCard title="My Reviews" icon={Star} count={summary?.role === 'CONTRACTOR' ? summary.myReviewsCount : 0} onPress={() => navigation.navigate('MyReviews')} />
        </>
      ) : (
        <>
          <ActivityCard title={isAdmin ? 'All Jobs' : 'My Jobs'} icon={BriefcaseBusiness} count={summary?.role !== 'CONTRACTOR' ? summary?.myJobsCount ?? 0 : 0} onPress={() => navigation.getParent()?.navigate('JobsTab', { screen: 'EmployerJobs' })} />
          <ActivityCard title="Offers Received" icon={ClipboardList} count={summary?.role !== 'CONTRACTOR' ? summary?.offersReceivedCount ?? 0 : 0} onPress={() => navigation.getParent()?.navigate('JobsTab', { screen: 'EmployerJobs' })} />
          <ActivityCard title="Selected Offers" icon={CheckCircle2} count={summary?.role !== 'CONTRACTOR' ? summary?.selectedOffersCount ?? 0 : 0} badge={summary?.role !== 'CONTRACTOR' && summary?.selectedOffersCount ? 'LOCKED UNTIL UNLOCK' : undefined} onPress={() => navigation.getParent()?.navigate('JobsTab', { screen: 'EmployerJobs' })} />
          <ActivityCard title="Unlocked Contacts" icon={UsersRound} count={summary?.role !== 'CONTRACTOR' ? summary?.unlockedContactsCount ?? 0 : 0} onPress={() => navigation.navigate('Contacts', { filter: 'all' })} />
          <ActivityCard
            title="Jobs In Progress"
            icon={BriefcaseBusiness}
            count={summary?.role !== 'CONTRACTOR' ? summary?.jobsInProgressCount ?? 0 : 0}
            badge={summary?.role !== 'CONTRACTOR' && summary?.jobsInProgressCount ? 'IN_PROGRESS' : undefined}
            onPress={() =>
              navigation.navigate('Contacts', {
                filter: 'in_progress',
                emptyTitle: 'No jobs in progress yet',
                emptyMessage: 'Unlocked jobs in progress will appear here.',
              })
            }
          />
          <ActivityCard
            title="Jobs Waiting Confirmation"
            icon={TimerReset}
            count={summary?.role !== 'CONTRACTOR' ? summary?.jobsWaitingConfirmationCount ?? 0 : 0}
            badge={summary?.role !== 'CONTRACTOR' && summary?.jobsWaitingConfirmationCount ? 'CONFIRM' : undefined}
            onPress={() =>
              navigation.navigate('Contacts', {
                filter: 'in_progress',
                emptyTitle: 'No jobs waiting confirmation',
                emptyMessage: 'Contractor completion requests will appear here.',
              })
            }
          />
          <ActivityCard title="Reviews To Leave" icon={Star} count={summary?.role !== 'CONTRACTOR' ? summary?.reviewsToLeaveCount ?? 0 : 0} onPress={() => navigation.navigate('Contacts', { filter: 'completed' })} />
          <ActivityCard title="Alerts" icon={Bell} count={summary?.role !== 'CONTRACTOR' ? summary?.alertsCount ?? 0 : 0} onPress={() => navigation.navigate('NotificationsHome')} />
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
