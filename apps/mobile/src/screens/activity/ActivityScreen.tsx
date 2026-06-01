import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Bell, BriefcaseBusiness, CheckCircle2, ClipboardList, Star, TimerReset, UsersRound } from 'lucide-react-native';
import { ComponentType, useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { api } from '../../api/client';
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
  const isFocused = useIsFocused();
  const user = useAuthStore((state) => state.user);
  const isContractor = user?.role === 'CONTRACTOR';
  const isEmployer = user?.role === 'EMPLOYER';
  const isAdmin = user?.role === 'ADMIN';

  const jobsQuery = useQuery({
    queryKey: ['activity', 'jobs', user?.role],
    queryFn: api.jobsMine,
    enabled: isEmployer || isAdmin,
    refetchInterval: isFocused && (isEmployer || isAdmin) ? 10_000 : false,
  });
  const offersQuery = useQuery({
    queryKey: ['activity', 'offers', 'mine'],
    queryFn: () => api.myOffers({ limit: 100 }),
    enabled: isContractor,
    refetchInterval: isFocused && isContractor ? 10_000 : false,
  });
  const contactsQuery = useQuery({
    queryKey: ['activity', 'contacts', user?.role],
    queryFn: () => api.contacts({ limit: 100 }),
    enabled: isEmployer || isContractor,
    refetchInterval: isFocused && (isEmployer || isContractor) ? 10_000 : false,
  });
  const reviewsQuery = useQuery({
    queryKey: ['activity', 'reviews', 'contractor'],
    queryFn: () => api.contractorReviews(user?.id ?? '', { limit: 50 }),
    enabled: isContractor && Boolean(user?.id),
    refetchInterval: isFocused && isContractor ? 10_000 : false,
  });

  const refetchActivity = useCallback(() => {
    if (isEmployer || isAdmin) {
      void jobsQuery.refetch();
    }
    if (isContractor) {
      void offersQuery.refetch();
      void reviewsQuery.refetch();
    }
    if (isEmployer || isContractor) {
      void contactsQuery.refetch();
    }
  }, [
    contactsQuery.refetch,
    isAdmin,
    isContractor,
    isEmployer,
    jobsQuery.refetch,
    offersQuery.refetch,
    reviewsQuery.refetch,
  ]);

  useFocusEffect(
    useCallback(() => {
      refetchActivity();
    }, [refetchActivity]),
  );

  const jobs = jobsQuery.data ?? [];
  const offers = offersQuery.data?.data ?? [];
  const contacts = contactsQuery.data?.data ?? [];
  const reviews = reviewsQuery.data?.data ?? [];
  const selectedOffers = offers.filter((offer) => offer.status === 'SELECTED');
  const unlockedContacts = contacts.filter((contact) => contact.status === 'UNLOCKED');
  const inProgressContacts = unlockedContacts.filter((contact) => contact.jobRequest.status === 'IN_PROGRESS');
  const completedContacts = unlockedContacts.filter((contact) => contact.jobRequest.status === 'COMPLETED');
  const employerInProgress = jobs.filter((job) => job.status === 'IN_PROGRESS');
  const employerCompleted = jobs.filter((job) => job.status === 'COMPLETED');
  const isLoading =
    ((isEmployer || isAdmin) && jobsQuery.isLoading) ||
    (isContractor && offersQuery.isLoading) ||
    ((isEmployer || isContractor) && contactsQuery.isLoading) ||
    (isContractor && reviewsQuery.isLoading);
  const isRefreshing =
    ((isEmployer || isAdmin) && jobsQuery.isRefetching) ||
    (isContractor && offersQuery.isRefetching) ||
    ((isEmployer || isContractor) && contactsQuery.isRefetching) ||
    (isContractor && reviewsQuery.isRefetching);
  const firstError =
    ((isEmployer || isAdmin) && jobsQuery.error) ||
    (isContractor && offersQuery.error) ||
    ((isEmployer || isContractor) && contactsQuery.error) ||
    (isContractor && reviewsQuery.error);

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
    <Screen refreshing={isRefreshing} onRefresh={refetchActivity}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Activity</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          {isContractor ? 'Offers, selected work, unlocked contacts, and reviews.' : 'Jobs, received offers, confirmations, contacts, and reviews.'}
        </Text>
      </View>

      {firstError ? (
        <EmptyState
          icon={TimerReset}
          title="Could not refresh activity"
          message={firstError instanceof Error ? firstError.message : 'Please try again.'}
          actionTitle="Retry"
          onAction={refetchActivity}
        />
      ) : null}

      {isContractor ? (
        <>
          <ActivityCard title="My Offers" icon={ClipboardList} count={offers.length} onPress={() => navigation.getParent()?.navigate('JobsTab', { screen: 'MyOffers' })} />
          <ActivityCard title="Selected Offers" icon={CheckCircle2} count={selectedOffers.length} badge="Unlock Contact" onPress={() => navigation.getParent()?.navigate('JobsTab', { screen: 'MyOffers' })} />
          <ActivityCard title="Unlocked Contacts" icon={UsersRound} count={unlockedContacts.length} onPress={() => navigation.navigate('Contacts')} />
          <ActivityCard title="Jobs In Progress" icon={BriefcaseBusiness} count={inProgressContacts.length} badge="IN_PROGRESS" onPress={() => navigation.navigate('Contacts')} />
          <ActivityCard title="Completed Jobs" icon={CheckCircle2} count={completedContacts.length} badge="COMPLETED" onPress={() => navigation.navigate('Contacts')} />
          <ActivityCard title="My Reviews" icon={Star} count={reviews.length} onPress={() => navigation.navigate('MyReviews')} />
        </>
      ) : (
        <>
          <ActivityCard title={isAdmin ? 'All Jobs' : 'My Jobs'} icon={BriefcaseBusiness} count={jobs.length} onPress={() => navigation.getParent()?.navigate('JobsTab', { screen: 'EmployerJobs' })} />
          <ActivityCard title="Offers Received" icon={ClipboardList} count={jobs.reduce((total, job) => total + (job.status === 'ACTIVE' || job.status === 'IN_PROGRESS' ? 1 : 0), 0)} onPress={() => navigation.getParent()?.navigate('JobsTab', { screen: 'EmployerJobs' })} />
          <ActivityCard title="Selected Offers" icon={CheckCircle2} count={employerInProgress.length} badge="LOCKED UNTIL UNLOCK" onPress={() => navigation.getParent()?.navigate('JobsTab', { screen: 'EmployerJobs' })} />
          <ActivityCard title="Unlocked Contacts" icon={UsersRound} count={unlockedContacts.length} onPress={() => navigation.navigate('Contacts')} />
          <ActivityCard title="Jobs In Progress" icon={BriefcaseBusiness} count={employerInProgress.length} badge="IN_PROGRESS" onPress={() => navigation.navigate('Contacts')} />
          <ActivityCard title="Jobs Waiting Confirmation" icon={TimerReset} count={inProgressContacts.length} badge="CONFIRM" onPress={() => navigation.navigate('Contacts')} />
          <ActivityCard title="Reviews To Leave" icon={Star} count={employerCompleted.length} onPress={() => navigation.navigate('Contacts')} />
          <ActivityCard title="Alerts" icon={Bell} count={0} onPress={() => navigation.navigate('NotificationsHome')} />
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
