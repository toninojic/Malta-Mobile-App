import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BriefcaseBusiness, CalendarClock, MapPin, Plus, RefreshCw, Search, SendHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { api } from '../../api/client';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { OptionSelect } from '../../components/OptionSelect';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { SERVICE_CATEGORIES, serviceCategoryLabel, serviceSubcategoryLabel } from '../../config/serviceCategories';
import { useTheme } from '../../design/theme';
import { JobsStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/auth.store';
import { JobBrowseFilters, JobRequest } from '../../types/domain';

type Props = NativeStackScreenProps<JobsStackParamList, 'EmployerJobs'>;

export function EmployerJobsScreen({ navigation }: Props) {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const canViewJobs = user?.role === 'EMPLOYER' || user?.role === 'ADMIN';
  const canCreateJobs = user?.role === 'EMPLOYER';

  if (user?.role === 'CONTRACTOR') {
    return <ContractorJobsScreen navigation={navigation} />;
  }

  const query = useQuery({
    queryKey: ['jobs', 'mine'],
    queryFn: api.jobsMine,
    enabled: canViewJobs,
  });

  if (!canViewJobs) {
    return (
      <Screen>
        <EmptyState
          icon={BriefcaseBusiness}
          title="Contractor account ready"
          message="Profile management is available for this account."
        />
      </Screen>
    );
  }

  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {user?.role === 'ADMIN' ? 'All job requests' : 'Your job requests'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            Active posts expire 30 days after creation or renewal.
          </Text>
        </View>
        {canCreateJobs ? (
          <Button title="New" icon={Plus} onPress={() => navigation.navigate('JobForm', {})} style={styles.newButton} />
        ) : null}
      </View>

      {query.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : null}

      {query.error ? (
        <EmptyState
          icon={RefreshCw}
          title="Could not load jobs"
          message={query.error instanceof Error ? query.error.message : 'Please try again.'}
          actionTitle="Retry"
          onAction={() => void query.refetch()}
        />
      ) : null}

      {query.data?.length === 0 ? (
        <EmptyState
          icon={BriefcaseBusiness}
          title="No job requests yet"
          message="Create the first request and keep every detail in one place."
          actionTitle={canCreateJobs ? 'Create Job' : undefined}
          onAction={canCreateJobs ? () => navigation.navigate('JobForm', {}) : undefined}
        />
      ) : null}

      <View style={styles.list}>
        {query.data?.map((job) => (
          <JobCard key={job.id} job={job} onPress={() => navigation.navigate('JobDetails', { jobId: job.id })} />
        ))}
      </View>
    </Screen>
  );
}

function ContractorJobsScreen({ navigation }: Pick<Props, 'navigation'>) {
  const theme = useTheme();
  const [draftCategory, setDraftCategory] = useState('');
  const [draftSubcategory, setDraftSubcategory] = useState('');
  const [draftLocation, setDraftLocation] = useState('');
  const [filters, setFilters] = useState<JobBrowseFilters>({ limit: 50, sortBy: 'newest' });
  const selectedCategory = SERVICE_CATEGORIES.find((item) => item.key === draftCategory);

  const query = useQuery({
    queryKey: ['jobs', 'browse', filters],
    queryFn: () => api.browseJobs(filters),
  });
  const offersQuery = useQuery({
    queryKey: ['offers', 'mine', 'activity-count'],
    queryFn: () => api.myOffers({ limit: 100 }),
  });
  const activeOfferCount =
    offersQuery.data?.data.filter((offer) => offer.status === 'PENDING' || offer.status === 'SELECTED').length ?? 0;

  const applyFilters = () => {
    setFilters({
      category: draftCategory || undefined,
      subcategory: draftSubcategory || undefined,
      location: draftLocation,
      limit: 50,
      sortBy: 'newest',
    });
  };

  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Browse job requests</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Find active work requests across Malta.</Text>
        </View>
        <Button
          title={activeOfferCount ? `My Offers (${activeOfferCount})` : 'My Offers'}
          icon={SendHorizontal}
          onPress={() => navigation.navigate('MyOffers')}
          style={styles.offersButton}
        />
      </View>

      <Card>
        <Text style={[styles.filterTitle, { color: theme.colors.text }]}>Filters</Text>
        <OptionSelect
          label="Category"
          value={draftCategory}
          options={SERVICE_CATEGORIES}
          onChange={(value) => {
            setDraftCategory(value);
            setDraftSubcategory('');
          }}
        />
        <OptionSelect
          label="Subcategory"
          value={draftSubcategory}
          options={selectedCategory?.subcategories ?? []}
          placeholder="Choose a category first."
          onChange={setDraftSubcategory}
        />
        <TextField label="Location" value={draftLocation} onChangeText={setDraftLocation} placeholder="Sliema" />
        <View style={styles.filterActions}>
          <Button title="Apply" icon={Search} onPress={applyFilters} style={styles.filterAction} />
          <Button
            title="Clear"
            variant="secondary"
            onPress={() => {
              setDraftCategory('');
              setDraftSubcategory('');
              setDraftLocation('');
              setFilters({ limit: 50, sortBy: 'newest' });
            }}
            style={styles.filterAction}
          />
        </View>
      </Card>

      {query.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : null}

      {query.error ? (
        <EmptyState
          icon={RefreshCw}
          title="Could not load jobs"
          message={query.error instanceof Error ? query.error.message : 'Please try again.'}
          actionTitle="Retry"
          onAction={() => void query.refetch()}
        />
      ) : null}

      {query.data?.data.length === 0 ? (
        <EmptyState
          icon={BriefcaseBusiness}
          title="No matching jobs"
          message="Try a wider category or location."
        />
      ) : null}

      <View style={styles.list}>
        {query.data?.data.map((job) => (
          <JobCard key={job.id} job={job} onPress={() => navigation.navigate('JobDetails', { jobId: job.id })} />
        ))}
      </View>
    </Screen>
  );
}

function JobCard({ job, onPress }: { job: JobRequest; onPress: () => void }) {
  const theme = useTheme();
  const expiresAt = new Date(job.expiresAt).toLocaleDateString();

  return (
    <Card onPress={onPress}>
      <View style={styles.cardTop}>
        <View style={styles.cardTitleWrap}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{job.title}</Text>
          <Text style={[styles.cardMeta, { color: theme.colors.textMuted }]}>
            {serviceCategoryLabel(job.category)} / {serviceSubcategoryLabel(job.category, job.subcategory)}
          </Text>
        </View>
        <Badge status={job.status} />
      </View>
      <Text numberOfLines={3} style={[styles.description, { color: theme.colors.textMuted }]}>
        {job.description}
      </Text>
      <View style={styles.metaRow}>
        <MapPin color={theme.colors.textMuted} size={16} />
        <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>{job.location}</Text>
      </View>
      <View style={styles.metaRow}>
        <CalendarClock color={theme.colors.textMuted} size={16} />
        <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>Expires {expiresAt}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  newButton: {
    width: 88,
  },
  offersButton: {
    width: 142,
  },
  filterActions: {
    flexDirection: 'row',
    gap: 10,
  },
  filterAction: {
    flex: 1,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '800',
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
  description: {
    fontSize: 14,
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 13,
  },
});
