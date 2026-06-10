import { BriefcaseBusiness, RefreshCw, XCircle } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useAdminJobs, useCloseAdminJob } from '../../api/adminHooks';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { OptionSelect } from '../../components/OptionSelect';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useTheme } from '../../design/theme';
import { JobRequest, JobStatus } from '../../types/domain';

const STATUS_OPTIONS = [
  { key: 'ALL', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CLOSED', label: 'Closed' },
  { key: 'EXPIRED', label: 'Expired' },
];

export function AdminJobsScreen() {
  const theme = useTheme();
  const [status, setStatus] = useState('ALL');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const filters = useMemo(
    () => ({
      status: status === 'ALL' ? undefined : (status as JobStatus),
      category: category.trim() || undefined,
      location: location.trim() || undefined,
    }),
    [category, location, status],
  );
  const jobsQuery = useAdminJobs(filters);
  const closeMutation = useCloseAdminJob();

  const confirmClose = (job: JobRequest) => {
    Alert.alert('Close job', `Close "${job.title}"? This will cancel the job and block reviews.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close',
        style: 'destructive',
        onPress: () => closeMutation.mutate(job.id),
      },
    ]);
  };

  return (
    <Screen contentTopPadding={28}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Jobs</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Inspect requests, filter by status, and close unsafe or cancelled jobs.</Text>
      </View>

      <OptionSelect label="Status" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
      <TextField label="Category" value={category} onChangeText={setCategory} placeholder="Electrician, plumbing..." />
      <TextField label="Location" value={location} onChangeText={setLocation} placeholder="Sliema, Valletta..." />

      {jobsQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : null}

      {jobsQuery.error ? (
        <EmptyState
          icon={RefreshCw}
          title="Could not load jobs"
          message={jobsQuery.error instanceof Error ? jobsQuery.error.message : 'Please try again.'}
          actionTitle="Retry"
          onAction={() => void jobsQuery.refetch()}
        />
      ) : null}

      {jobsQuery.data?.data.length === 0 ? (
        <EmptyState icon={BriefcaseBusiness} title="No jobs" message="No job requests match these filters." />
      ) : null}

      <View style={styles.list}>
        {jobsQuery.data?.data.map((job) => (
          <Card key={job.id}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{job.title}</Text>
                <Text style={[styles.meta, { color: theme.colors.textMuted }]}>{job.location}</Text>
              </View>
              <Badge status={job.status} />
            </View>
            <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
              {job.category} / {job.subcategory}
            </Text>
            <Text style={[styles.description, { color: theme.colors.text }]} numberOfLines={3}>
              {job.description}
            </Text>
            <Button
              title="Close Job"
              icon={XCircle}
              variant="danger"
              disabled={job.status === 'CLOSED' || job.status === 'COMPLETED'}
              loading={closeMutation.isPending}
              onPress={() => confirmClose(job)}
            />
          </Card>
        ))}
      </View>
    </Screen>
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
  list: {
    gap: 12,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  flex: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  meta: {
    fontSize: 13,
    lineHeight: 19,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
});
