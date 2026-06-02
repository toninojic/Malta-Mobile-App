import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
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

export function NotificationsScreen() {
  const theme = useTheme();
  const isFocused = useIsFocused();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';
  const notificationsQuery = useNotifications(!isAdmin, isFocused && !isAdmin);
  const adminNotificationsQuery = useAdminNotifications(isAdmin, isFocused && isAdmin);
  const query = isAdmin ? adminNotificationsQuery : notificationsQuery;
  const markReadMutation = useMarkNotificationRead();
  const markAllMutation = useMarkAllNotificationsRead();

  useFocusEffect(
    useCallback(() => {
      void query.refetch({ cancelRefetch: false });
    }, [query.refetch]),
  );

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{isAdmin ? 'All notifications' : 'Notifications'}</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Message and contact unlock updates.</Text>
        </View>
        {!isAdmin ? (
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

      {query.data?.data.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" message="Unread updates will appear here." />
      ) : null}

      <View style={styles.list}>
        {query.data?.data.map((notification) => (
          <NotificationCard
            key={notification.id}
            notification={notification}
            admin={isAdmin}
            reading={markReadMutation.isPending}
            onRead={() => markReadMutation.mutate(notification.id)}
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
}: {
  notification: InAppNotification;
  admin: boolean;
  reading: boolean;
  onRead: () => void;
}) {
  const theme = useTheme();

  return (
    <Card>
      <View style={styles.cardTop}>
        <View style={styles.cardCopy}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{notification.title}</Text>
          <Text style={[styles.body, { color: theme.colors.textMuted }]}>{notification.body}</Text>
        </View>
        <View style={[styles.dot, { backgroundColor: notification.isRead ? theme.colors.border : theme.colors.primary }]} />
      </View>
      <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
        {notification.type} / {new Date(notification.createdAt).toLocaleString()}
      </Text>
      {!admin && !notification.isRead ? (
        <Button title="Mark Read" icon={CheckCheck} variant="secondary" loading={reading} onPress={onRead} />
      ) : null}
    </Card>
  );
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
