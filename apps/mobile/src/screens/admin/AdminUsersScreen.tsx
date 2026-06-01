import { RefreshCw, ShieldOff, UserCheck, UsersRound } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useActivateUser, useAdminUsers, useSuspendUser } from '../../api/adminHooks';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { OptionSelect } from '../../components/OptionSelect';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useTheme } from '../../design/theme';
import { useAuthStore } from '../../store/auth.store';
import { AdminUser, UserRole, UserStatus } from '../../types/domain';

const ROLE_OPTIONS = [
  { key: 'ALL', label: 'All roles' },
  { key: 'EMPLOYER', label: 'Employers' },
  { key: 'CONTRACTOR', label: 'Contractors' },
  { key: 'ADMIN', label: 'Admins' },
];

const STATUS_OPTIONS = [
  { key: 'ALL', label: 'All statuses' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'SUSPENDED', label: 'Suspended' },
];

export function AdminUsersScreen() {
  const theme = useTheme();
  const currentUser = useAuthStore((state) => state.user);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      role: role === 'ALL' ? undefined : (role as UserRole),
      status: status === 'ALL' ? undefined : (status as UserStatus),
    }),
    [role, search, status],
  );
  const usersQuery = useAdminUsers(filters);
  const suspendMutation = useSuspendUser();
  const activateMutation = useActivateUser();

  const confirmSuspend = (user: AdminUser) => {
    Alert.alert('Suspend user', `Suspend ${user.email}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Suspend',
        style: 'destructive',
        onPress: () => suspendMutation.mutate(user.id),
      },
    ]);
  };

  const confirmActivate = (user: AdminUser) => {
    Alert.alert('Activate user', `Activate ${user.email}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Activate',
        onPress: () => activateMutation.mutate(user.id),
      },
    ]);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Users</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Search profiles, review roles, and suspend or activate accounts.</Text>
      </View>

      <TextField label="Search" value={search} onChangeText={setSearch} placeholder="Email, name, phone, company" />
      <OptionSelect label="Role" value={role} options={ROLE_OPTIONS} onChange={setRole} />
      <OptionSelect label="Status" value={status} options={STATUS_OPTIONS} onChange={setStatus} />

      {usersQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : null}

      {usersQuery.error ? (
        <EmptyState
          icon={RefreshCw}
          title="Could not load users"
          message={usersQuery.error instanceof Error ? usersQuery.error.message : 'Please try again.'}
          actionTitle="Retry"
          onAction={() => void usersQuery.refetch()}
        />
      ) : null}

      {usersQuery.data?.data.length === 0 ? (
        <EmptyState icon={UsersRound} title="No users" message="No users match these filters." />
      ) : null}

      <View style={styles.list}>
        {usersQuery.data?.data.map((user) => {
          const isSelf = user.id === currentUser?.id;
          const canSuspend = user.status === 'ACTIVE' && !isSelf;
          const canActivate = user.status === 'SUSPENDED';

          return (
            <Card key={user.id}>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{user.profile?.displayName ?? user.email}</Text>
                  <Text style={[styles.meta, { color: theme.colors.textMuted }]}>{user.email}</Text>
                </View>
                <Badge status={user.status} />
              </View>
              <View style={styles.badges}>
                <Badge status={user.role} />
                {user.profile?.phone ? <Badge status={user.profile.phone} /> : null}
                {user.profile?.companyName ? <Badge status={user.profile.companyName} /> : null}
              </View>
              <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
                Jobs: {user.counts?.jobRequests ?? 0} / Offers: {user.counts?.offers ?? 0} / Tokens:{' '}
                {user.tokenBalance?.balance ?? 0}
              </Text>
              <View style={styles.actions}>
                <Button
                  title="Suspend"
                  icon={ShieldOff}
                  variant="danger"
                  disabled={!canSuspend}
                  loading={suspendMutation.isPending}
                  onPress={() => confirmSuspend(user)}
                  style={styles.action}
                />
                <Button
                  title="Activate"
                  icon={UserCheck}
                  variant="secondary"
                  disabled={!canActivate}
                  loading={activateMutation.isPending}
                  onPress={() => confirmActivate(user)}
                  style={styles.action}
                />
              </View>
            </Card>
          );
        })}
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
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  action: {
    flex: 1,
  },
});
