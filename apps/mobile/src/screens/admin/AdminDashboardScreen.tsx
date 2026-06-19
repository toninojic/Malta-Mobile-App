import { Activity, BriefcaseBusiness, MessageCircle, RefreshCw, RotateCcw, Star, UsersRound, WalletCards } from 'lucide-react-native';
import { ComponentType } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAdminStatistics } from '../../api/adminHooks';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../design/theme';

const formatter = new Intl.NumberFormat('en-MT', {
  maximumFractionDigits: 2,
});

export function AdminDashboardScreen() {
  const theme = useTheme();
  const query = useAdminStatistics();

  return (
    <Screen contentTopPadding={28} refreshing={query.isRefetching} onRefresh={() => void query.refetch({ cancelRefetch: false })}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Admin dashboard</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Platform overview, moderation health, and MVP revenue.</Text>
      </View>

      {query.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : null}

      {query.error ? (
        <EmptyState
          icon={RefreshCw}
          title="Could not load dashboard"
          message={query.error instanceof Error ? query.error.message : 'Please try again.'}
          actionTitle="Retry"
          onAction={() => void query.refetch()}
        />
      ) : null}

      {query.data ? (
        <View style={styles.grid}>
          <Metric icon={UsersRound} label="Total users" value={query.data.users.total} detail={`${query.data.users.suspended} suspended`} />
          <Metric icon={BriefcaseBusiness} label="Active jobs" value={query.data.jobs.active} detail={`${query.data.jobs.inProgress} in progress`} />
          <Metric icon={Activity} label="Completed jobs" value={query.data.jobs.completed} detail={`${query.data.jobs.closed} closed`} />
          <Metric icon={RotateCcw} label="Pending refunds" value={query.data.refunds.pending} detail={`${query.data.refunds.approved} approved`} />
          <Metric icon={Star} label="Removed reviews" value={query.data.reviews.removed} detail={`${query.data.reviews.averageRating} avg rating`} />
          <Metric icon={WalletCards} label="Test revenue" value={`EUR ${formatter.format(query.data.payments.testRevenue)}`} detail={`${query.data.payments.paid} paid payments`} />
          <Metric
            icon={WalletCards}
            label="Promo tokens"
            value={query.data.tokens.promoTokensGranted}
            detail={`${query.data.tokens.adminGrantedTokens} admin / ${query.data.tokens.welcomeBonusTokensGranted} welcome / ${query.data.tokens.adminRevokedTokens} revoked`}
          />
          <Metric icon={MessageCircle} label="Total messages" value={query.data.conversations.messages} detail={`${query.data.conversations.total} conversations`} />
        </View>
      ) : null}
    </Screen>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: ComponentType<{ color?: string; size?: number }>;
  label: string;
  value: string | number;
  detail: string;
}) {
  const theme = useTheme();

  return (
    <Card style={styles.metric}>
      <View style={[styles.iconWrap, { backgroundColor: `${theme.colors.primary}18` }]}>
        <Icon color={theme.colors.primary} size={20} />
      </View>
      <Text style={[styles.metricValue, { color: theme.colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: theme.colors.text }]}>{label}</Text>
      <Text style={[styles.metricDetail, { color: theme.colors.textMuted }]}>{detail}</Text>
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
    paddingVertical: 24,
  },
  grid: {
    gap: 12,
  },
  metric: {
    gap: 8,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: '900',
  },
  metricLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  metricDetail: {
    fontSize: 13,
  },
});
