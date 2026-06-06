import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { BriefcaseBusiness, CalendarClock, Filter, MapPin, Plus, RefreshCw, Search, SendHorizontal, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../api/client';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { CategoryAccordion } from '../../components/CategoryAccordion';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { serviceCategoryLabel, serviceSubcategoryLabel } from '../../config/serviceCategories';
import { useTheme } from '../../design/theme';
import { JobsStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/auth.store';
import { JobBrowseFilters, JobRequest } from '../../types/domain';
import { formatDate } from '../../utils/date';
import { isActiveOffer } from '../../utils/offerWork';

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
    refetchOnWindowFocus: true,
  });

  useFocusEffect(
    useCallback(() => {
      void query.refetch({ cancelRefetch: false });
    }, [query.refetch]),
  );

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState('');
  const [draftSubcategory, setDraftSubcategory] = useState('');
  const [draftLocation, setDraftLocation] = useState('');
  const [draftSortBy, setDraftSortBy] = useState<'newest' | 'oldest'>('newest');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<JobBrowseFilters>({ limit: 50, sortBy: 'newest' });

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 450);
    return () => clearTimeout(timeout);
  }, [search]);

  const query = useQuery({
    queryKey: ['jobs', 'browse', filters, debouncedSearch],
    queryFn: () => api.browseJobs({ ...filters, search: debouncedSearch || undefined }),
    refetchOnWindowFocus: true,
  });
  const offersQuery = useQuery({
    queryKey: ['offers', 'mine', 'activity-count'],
    queryFn: () => api.myOffers({ limit: 100 }),
    refetchOnWindowFocus: true,
  });
  const activeOfferCount =
    offersQuery.data?.data.filter(isActiveOffer).length ?? 0;

  const applyFilters = () => {
    setFilters({
      category: draftCategory || undefined,
      subcategory: draftSubcategory || undefined,
      location: draftLocation,
      limit: 50,
      sortBy: draftSortBy,
    });
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    setDraftCategory('');
    setDraftSubcategory('');
    setDraftLocation('');
    setDraftSortBy('newest');
    setFilters({ limit: 50, sortBy: 'newest' });
    setFiltersOpen(false);
  };

  useFocusEffect(
    useCallback(() => {
      void query.refetch({ cancelRefetch: false });
      void offersQuery.refetch({ cancelRefetch: false });
    }, [offersQuery.refetch, query.refetch]),
  );

  const filterChips = activeFilterChips(filters);

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
          onPress={() => navigation.navigate('MyOffers', { mode: 'active' })}
          style={styles.offersButton}
        />
      </View>

      <TextField label="Search jobs" value={search} onChangeText={setSearch} placeholder="Search by title or description" icon={Search} />

      <Card style={styles.filterCard}>
        <View style={styles.filterHeader}>
          <View style={styles.filterHeaderCopy}>
            <Text style={[styles.filterTitle, { color: theme.colors.text }]}>Filters</Text>
            <Text style={[styles.filterSummary, { color: theme.colors.textMuted }]}>
              {filterChips.length ? filterChips.join(' / ') : 'Category: Any / Location: Any / Sort: Newest'}
            </Text>
          </View>
          <Button
            title={filtersOpen ? 'Close' : 'Filters'}
            icon={filtersOpen ? X : Filter}
            variant="secondary"
            onPress={() => setFiltersOpen((current) => !current)}
            style={styles.filterToggle}
          />
        </View>

        {filterChips.length ? (
          <View style={styles.chips}>
            {filterChips.map((chip) => (
              <View key={chip} style={[styles.chip, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
                <Text style={[styles.chipText, { color: theme.colors.text }]}>{chip}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {filtersOpen ? (
          <View style={styles.filterPanel}>
            <CategoryAccordion
              label="Category"
              category={draftCategory}
              subcategory={draftSubcategory}
              onSelect={(nextCategory, nextSubcategory) => {
                setDraftCategory(nextCategory);
                setDraftSubcategory(nextSubcategory);
              }}
            />
            <TextField label="Location" value={draftLocation} onChangeText={setDraftLocation} placeholder="Sliema" />
            <View style={styles.sortRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setDraftSortBy('newest')}
                style={[
                  styles.sortOption,
                  {
                    backgroundColor: draftSortBy === 'newest' ? theme.colors.primary : theme.colors.surfaceMuted,
                    borderColor: draftSortBy === 'newest' ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              >
                <Text style={[styles.sortText, { color: draftSortBy === 'newest' ? '#FFFFFF' : theme.colors.text }]}>Newest</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setDraftSortBy('oldest')}
                style={[
                  styles.sortOption,
                  {
                    backgroundColor: draftSortBy === 'oldest' ? theme.colors.primary : theme.colors.surfaceMuted,
                    borderColor: draftSortBy === 'oldest' ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              >
                <Text style={[styles.sortText, { color: draftSortBy === 'oldest' ? '#FFFFFF' : theme.colors.text }]}>Oldest</Text>
              </Pressable>
            </View>
            <View style={styles.filterActions}>
              <Button title="Apply" icon={Search} onPress={applyFilters} style={styles.filterAction} />
              <Button title="Clear" variant="secondary" onPress={clearFilters} style={styles.filterAction} />
            </View>
          </View>
        ) : null}
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
        <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>Expires {formatDate(job.expiresAt)}</Text>
      </View>
    </Card>
  );
}

function activeFilterChips(filters: JobBrowseFilters) {
  const chips: string[] = [];

  if (filters.category) {
    chips.push(serviceCategoryLabel(filters.category));
  }

  if (filters.subcategory && filters.category) {
    chips.push(serviceSubcategoryLabel(filters.category, filters.subcategory));
  }

  if (filters.location?.trim()) {
    chips.push(filters.location.trim());
  }

  if (filters.sortBy === 'oldest') {
    chips.push('Oldest');
  }

  return chips;
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
  filterCard: {
    gap: 10,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  filterSummary: {
    fontSize: 12,
    lineHeight: 17,
  },
  filterToggle: {
    width: 104,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterPanel: {
    gap: 12,
  },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sortOption: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  sortText: {
    fontSize: 14,
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
