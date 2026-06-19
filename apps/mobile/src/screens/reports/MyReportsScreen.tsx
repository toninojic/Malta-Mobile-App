import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Flag, RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMyReports } from '../../api/reportHooks';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { OptionSelect } from '../../components/OptionSelect';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../design/theme';
import { ActivityStackParamList } from '../../navigation/types';
import { ReportStatus } from '../../types/domain';
import { formatDate } from '../../utils/date';
import { REPORT_STATUS_OPTIONS, reportReasonLabel, reportTargetLabel } from '../../utils/reportLabels';

type Props = NativeStackScreenProps<ActivityStackParamList, 'MyReports'>;

const STATUS_FILTER_OPTIONS = [{ key: 'ALL', label: 'All' }, ...REPORT_STATUS_OPTIONS];

export function MyReportsScreen(_props: Props) {
  const theme = useTheme();
  const [status, setStatus] = useState<'ALL' | ReportStatus>('ALL');
  const query = useMyReports(status === 'ALL' ? {} : { status });

  return (
    <Screen
      contentTopPadding={28}
      refreshing={query.isRefetching}
      onRefresh={() => {
        if (!query.isFetching) {
          void query.refetch({ cancelRefetch: false });
        }
      }}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>My Reports</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          Track reports you submitted to the MaltaPro admin team.
        </Text>
      </View>

      <OptionSelect
        label="Status"
        value={status}
        options={STATUS_FILTER_OPTIONS}
        onChange={(value) => setStatus(value as 'ALL' | ReportStatus)}
      />

      {query.error ? (
        <EmptyState
          icon={RefreshCw}
          title="Could not load reports"
          message={query.error instanceof Error ? query.error.message : 'Please try again.'}
          actionTitle="Retry"
          onAction={() => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && query.data?.data.length === 0 ? (
        <EmptyState icon={Flag} title="No reports" message="Reports you submit will appear here." />
      ) : null}

      <View style={styles.list}>
        {query.data?.data.map((report) => (
          <Card key={report.id}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                  {report.targetSummary?.title ?? reportTargetLabel(report.targetType)}
                </Text>
                <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
                  {reportTargetLabel(report.targetType)} / {reportReasonLabel(report.reason)} / {formatDate(report.createdAt)}
                </Text>
              </View>
              <Badge status={report.status} />
            </View>
            {report.description ? (
              <Text style={[styles.body, { color: theme.colors.textMuted }]}>{report.description}</Text>
            ) : null}
            {report.adminNote ? (
              <View style={[styles.note, { borderColor: theme.colors.border }]}>
                <Text style={[styles.noteLabel, { color: theme.colors.text }]}>Admin note</Text>
                <Text style={[styles.body, { color: theme.colors.textMuted }]}>{report.adminNote}</Text>
              </View>
            ) : null}
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
  body: {
    fontSize: 14,
    lineHeight: 21,
  },
  note: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
    paddingTop: 10,
  },
  noteLabel: {
    fontSize: 13,
    fontWeight: '900',
  },
});
