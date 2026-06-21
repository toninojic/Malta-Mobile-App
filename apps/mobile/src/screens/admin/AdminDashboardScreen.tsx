import { Activity, BriefcaseBusiness, MessageCircle, RefreshCw, RotateCcw, Star, UsersRound, WalletCards } from 'lucide-react-native';
import { ComponentType } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAdminAnalyticsErrors, useAdminAnalyticsFunnels, useAdminAnalyticsOverview, useAdminStatistics } from '../../api/adminHooks';
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
  const analyticsOverviewQuery = useAdminAnalyticsOverview();
  const analyticsFunnelsQuery = useAdminAnalyticsFunnels();
  const analyticsErrorsQuery = useAdminAnalyticsErrors();

  return (
    <Screen
      contentTopPadding={28}
      refreshing={query.isRefetching || analyticsOverviewQuery.isRefetching || analyticsFunnelsQuery.isRefetching || analyticsErrorsQuery.isRefetching}
      onRefresh={() => {
        void query.refetch({ cancelRefetch: false });
        void analyticsOverviewQuery.refetch({ cancelRefetch: false });
        void analyticsFunnelsQuery.refetch({ cancelRefetch: false });
        void analyticsErrorsQuery.refetch({ cancelRefetch: false });
      }}
    >
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

      {analyticsOverviewQuery.data ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Product analytics</Text>
          <View style={styles.grid}>
            <Metric
              icon={Activity}
              label="Active users"
              value={analyticsOverviewQuery.data.activeUsers.last24h}
              detail={`${analyticsOverviewQuery.data.activeUsers.last7d} in 7 days`}
            />
            <Metric
              icon={Activity}
              label="Tracked events"
              value={analyticsOverviewQuery.data.totalEvents}
              detail={`${analyticsOverviewQuery.data.topActions[0]?.eventName ?? 'No actions yet'}`}
            />
          </View>
          <AnalyticsList title="Most viewed screens" items={analyticsOverviewQuery.data.mostViewedScreens.map((item) => ({ label: item.screen, count: item.count }))} />
          <AnalyticsList title="Top failures" items={analyticsOverviewQuery.data.topFailures.map((item) => ({ label: item.eventName, count: item.count }))} />
        </View>
      ) : null}

      {analyticsFunnelsQuery.data ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Funnels</Text>
          <AnalyticsList title="Employer funnel" items={analyticsFunnelsQuery.data.employer.map((item) => ({ label: item.eventName, count: item.count }))} />
          <AnalyticsList title="Contractor funnel" items={analyticsFunnelsQuery.data.contractor.map((item) => ({ label: item.eventName, count: item.count }))} />
        </View>
      ) : null}

      {analyticsErrorsQuery.data ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Friction</Text>
          <View style={styles.grid}>
            <Metric icon={RefreshCw} label="Offer failures" value={analyticsErrorsQuery.data.counts.failedOfferCreation} detail="Offer creation failed" />
            <Metric icon={RefreshCw} label="Job failures" value={analyticsErrorsQuery.data.counts.failedJobCreation} detail="Job creation failed" />
            <Metric icon={RefreshCw} label="Unlock failures" value={analyticsErrorsQuery.data.counts.failedUnlock} detail="Contact unlock failed" />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function AnalyticsList({ title, items }: { title: string; items: Array<{ label: string; count: number }> }) {
  const theme = useTheme();
  const visibleItems = items.slice(0, 6);

  return (
    <Card style={styles.analyticsCard}>
      <Text style={[styles.metricLabel, { color: theme.colors.text }]}>{title}</Text>
      {visibleItems.length ? (
        visibleItems.map((item) => (
          <View key={item.label} style={styles.analyticsRow}>
            <Text numberOfLines={1} style={[styles.analyticsLabel, { color: theme.colors.textMuted }]}>{item.label}</Text>
            <Text style={[styles.analyticsCount, { color: theme.colors.text }]}>{item.count}</Text>
          </View>
        ))
      ) : (
        <Text style={[styles.metricDetail, { color: theme.colors.textMuted }]}>No events yet</Text>
      )}
    </Card>
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
  section: {
    gap: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  metric: {
    gap: 8,
  },
  analyticsCard: {
    gap: 10,
  },
  analyticsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  analyticsLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  analyticsCount: {
    fontSize: 14,
    fontWeight: '900',
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
