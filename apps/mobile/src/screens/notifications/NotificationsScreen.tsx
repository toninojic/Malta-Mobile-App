import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { Bell, CheckCheck, RefreshCw } from 'lucide-react-native';
import { useAdminNotifications, useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '../../api/notificationHooks';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../design/theme';
import { useAuthStore } from '../../store/auth.store';
import { InAppNotification } from '../../types/domain';
import { formatDateTime } from '../../utils/date';

type NotificationNavigation = {
  navigate: (screen: string, params?: unknown) => void;
};

export function NotificationsScreen() {
  const theme = useTheme();
  const isFocused = useIsFocused();
  const user = useAuthStore((state) => state.user);
  const navigation = useNavigation<NotificationNavigation>();
  const isAdmin = user?.role === 'ADMIN';
  const notificationsQuery = useNotifications(!isAdmin, isFocused && !isAdmin);
  const adminNotificationsQuery = useAdminNotifications(isAdmin, isFocused && isAdmin);
  const query = isAdmin ? adminNotificationsQuery : notificationsQuery;
  const markReadMutation = useMarkNotificationRead();
  const markAllMutation = useMarkAllNotificationsRead();
  const notifications = (query.data?.data ?? []).filter((notification) => notification.type !== 'NEW_MESSAGE');
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;
  const isRefreshing = query.isRefetching || markAllMutation.isPending;

  useFocusEffect(
    useCallback(() => {
      void query.refetch({ cancelRefetch: false });
    }, [query.refetch]),
  );

  return (
    <Screen
      contentTopPadding={44}
      refreshing={isRefreshing}
      onRefresh={() => {
        if (!query.isFetching) {
          void query.refetch({ cancelRefetch: false });
        }
      }}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{isAdmin ? 'All notifications' : 'Notifications'}</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Offer, contact, wallet, and review updates.</Text>
        </View>
        {!isAdmin && unreadCount > 0 ? (
          <Button
            title="Read All"
            icon={CheckCheck}
            variant="secondary"
            loading={markAllMutation.isPending}
            onPress={() => markAllMutation.mutate()}
            style={styles.readAllButton}
          />
        ) : null}
      </View>
      {!isAdmin && unreadCount === 0 ? (
        <Text style={[styles.noNewAlerts, { color: theme.colors.textMuted }]}>No new alerts</Text>
      ) : null}

      {query.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : null}

      {query.error ? (
        <EmptyState
          icon={RefreshCw}
          title="Could not load notifications"
          message={query.error instanceof Error ? query.error.message : 'Please try again.'}
          actionTitle="Retry"
          onAction={() => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && !query.error && notifications.length === 0 ? (
        <EmptyState icon={Bell} title={unreadCount === 0 ? 'No new alerts' : 'No alerts'} message="Non-message updates will appear here." />
      ) : null}

      <View style={styles.list}>
        {notifications.map((notification) => (
          <NotificationCard
            key={notification.id}
            notification={notification}
            admin={isAdmin}
            reading={markReadMutation.isPending}
            onRead={() => markReadMutation.mutate(notification.id)}
            onOpen={() => {
              if (!notification.isRead && !isAdmin) {
                markReadMutation.mutate(notification.id);
              }
              openNotificationTarget(navigation, notification, user?.role);
            }}
          />
        ))}
      </View>
    </Screen>
  );
}

function NotificationCard({
  notification,
  admin,
  reading,
  onRead,
  onOpen,
}: {
  notification: InAppNotification;
  admin: boolean;
  reading: boolean;
  onRead: () => void;
  onOpen: () => void;
}) {
  const theme = useTheme();

  return (
    <Card onPress={onOpen}>
      <View style={styles.cardTop}>
        <View style={styles.cardCopy}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{notification.title}</Text>
          <Text style={[styles.body, { color: theme.colors.textMuted }]}>{notification.body}</Text>
        </View>
        <View style={[styles.dot, { backgroundColor: notification.isRead ? theme.colors.border : theme.colors.primary }]} />
      </View>
      <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
        {notification.type} / {formatDateTime(notification.createdAt)}
      </Text>
      {!admin && !notification.isRead ? (
        <Button title="Mark Read" icon={CheckCheck} variant="secondary" loading={reading} onPress={onRead} />
      ) : null}
    </Card>
  );
}

function openNotificationTarget(
  navigation: NotificationNavigation,
  notification: InAppNotification,
  role?: 'EMPLOYER' | 'CONTRACTOR' | 'ADMIN',
) {
  const metadata = notification.metadata ?? {};
  const conversationId = stringMeta(metadata, 'conversationId');
  const offerId = stringMeta(metadata, 'offerId');
  const jobId = stringMeta(metadata, 'jobId') ?? stringMeta(metadata, 'jobRequestId');
  const reviewId = stringMeta(metadata, 'reviewId');
  const reportId = stringMeta(metadata, 'reportId');
  const employerReviewId = stringMeta(metadata, 'employerReviewId');
  const contactId = stringMeta(metadata, 'contactId') ?? stringMeta(metadata, 'contactUnlockId');
  const isEmployer = role === 'EMPLOYER';

  if (notification.type === 'NEW_MESSAGE' && conversationId) {
    navigation.navigate('MessagesTab', { screen: 'ConversationThread', params: { conversationId } });
    return;
  }

  if (notification.type === 'NEW_REPORT' && role === 'ADMIN') {
    navigation.navigate('AdminModerationTab');
    return;
  }

  if (notification.type === 'REPORT_STATUS_UPDATED' && reportId) {
    navigation.navigate('ActivityTab', { screen: 'MyReports' });
    return;
  }

  if (notification.type === 'NEW_OFFER' && isEmployer && jobId) {
    navigation.navigate('JobsTab', { screen: 'JobDetails', params: { jobId } });
    return;
  }

  if (notification.type === 'JOB_COMPLETED' && isEmployer) {
    if (contactId) {
      navigation.navigate('ActivityTab', { screen: 'ContactDetails', params: { contactId } });
      return;
    }

    if (jobId) {
      navigation.navigate('JobsTab', { screen: 'JobDetails', params: { jobId } });
      return;
    }
  }

  if (employerReviewId) {
    navigation.navigate('ActivityTab', { screen: 'ReviewDetails', params: { reviewId: employerReviewId, target: 'employer' } });
    return;
  }

  if ((notification.type === 'REVIEW_RECEIVED' || notification.type === 'REVIEW_REPLIED' || notification.type === 'REVIEW_REMOVED') && reviewId) {
    navigation.navigate('ActivityTab', { screen: 'ReviewDetails', params: { reviewId } });
    return;
  }

  if (conversationId) {
    navigation.navigate('MessagesTab', { screen: 'ConversationThread', params: { conversationId } });
    return;
  }

  if (offerId) {
    if (isEmployer && jobId) {
      navigation.navigate('JobsTab', { screen: 'JobDetails', params: { jobId } });
    } else {
      navigation.navigate('JobsTab', { screen: 'OfferWorkDetails', params: { offerId } });
    }
    return;
  }

  if (jobId) {
    navigation.navigate('JobsTab', { screen: 'JobDetails', params: { jobId } });
    return;
  }

  if (reviewId) {
    navigation.navigate('ActivityTab', { screen: 'ReviewDetails', params: { reviewId } });
    return;
  }

  if (contactId) {
    navigation.navigate('ActivityTab', { screen: 'ContactDetails', params: { contactId } });
    return;
  }

  if (notification.type === 'REFUND_APPROVED' || notification.type === 'REFUND_DENIED') {
    navigation.navigate('ActivityTab', { screen: 'WalletHome' });
  }
}

function stringMeta(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  headerCopy: {
    flex: 1,
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
  readAllButton: {
    width: 116,
  },
  noNewAlerts: {
    fontSize: 13,
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
  cardCopy: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    fontSize: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
});
