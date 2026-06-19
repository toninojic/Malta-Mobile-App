import { Coins, MinusCircle, RefreshCw, ShieldOff, UserCheck, UsersRound } from 'lucide-react-native';
import { ComponentType, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  useActivateUser,
  useAdminGrantTokens,
  useAdminRevokeTokens,
  useAdminUsers,
  useSuspendUser,
} from '../../api/adminHooks';
import { AppModal, AppModalAction } from '../../components/AppModal';
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

type ConfirmationDialog = {
  title: string;
  body: string;
  icon: ComponentType<{ color?: string; size?: number }>;
  actions: AppModalAction[];
};

type TokenDialog = {
  mode: 'grant' | 'revoke';
  user: AdminUser;
  amount: string;
  reason: string;
  error?: string;
};

export function AdminUsersScreen() {
  const theme = useTheme();
  const currentUser = useAuthStore((state) => state.user);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [confirmationDialog, setConfirmationDialog] = useState<ConfirmationDialog | null>(null);
  const [tokenDialog, setTokenDialog] = useState<TokenDialog | null>(null);
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
  const grantTokensMutation = useAdminGrantTokens();
  const revokeTokensMutation = useAdminRevokeTokens();

  const confirmSuspend = (user: AdminUser) => {
    setConfirmationDialog({
      title: 'Suspend User',
      body: `Suspend ${user.email}? This blocks protected actions until the account is activated again.`,
      icon: ShieldOff,
      actions: [
        { label: 'Cancel', variant: 'secondary', onPress: () => setConfirmationDialog(null) },
        {
          label: 'Suspend',
          variant: 'danger',
          onPress: () => {
            setConfirmationDialog(null);
            suspendMutation.mutate(user.id);
          },
        },
      ],
    });
  };

  const confirmActivate = (user: AdminUser) => {
    setConfirmationDialog({
      title: 'Activate User',
      body: `Activate ${user.email}? This restores access to MaltaPro.`,
      icon: UserCheck,
      actions: [
        { label: 'Cancel', variant: 'secondary', onPress: () => setConfirmationDialog(null) },
        {
          label: 'Activate',
          variant: 'primary',
          onPress: () => {
            setConfirmationDialog(null);
            activateMutation.mutate(user.id);
          },
        },
      ],
    });
  };

  const openTokenDialog = (mode: TokenDialog['mode'], user: AdminUser) => {
    setTokenDialog({
      mode,
      user,
      amount: mode === 'grant' ? '10' : '',
      reason: '',
    });
  };

  const submitTokenDialog = () => {
    if (!tokenDialog) {
      return;
    }

    const amount = Number(tokenDialog.amount);
    const reason = tokenDialog.reason.trim();
    const currentBalance = tokenDialog.user.tokenBalance?.balance ?? 0;

    if (!Number.isInteger(amount) || amount < 1) {
      setTokenDialog({ ...tokenDialog, error: 'Amount must be a whole number greater than zero.' });
      return;
    }

    if (amount > 1000) {
      setTokenDialog({ ...tokenDialog, error: 'Amount must be 1000 or less.' });
      return;
    }

    if (tokenDialog.mode === 'revoke' && amount > currentBalance) {
      setTokenDialog({ ...tokenDialog, error: 'Cannot revoke more tokens than the current balance.' });
      return;
    }

    if (!reason) {
      setTokenDialog({ ...tokenDialog, error: 'Reason is required.' });
      return;
    }

    if (tokenDialog.mode === 'grant') {
      grantTokensMutation.mutate(
        { userId: tokenDialog.user.id, amount, reason },
        {
          onSuccess: () => setTokenDialog(null),
          onError: (error) =>
            setTokenDialog({
              ...tokenDialog,
              error: error instanceof Error ? error.message : 'Could not grant tokens.',
            }),
        },
      );
      return;
    }

    revokeTokensMutation.mutate(
      { userId: tokenDialog.user.id, amount, reason },
      {
        onSuccess: () => setTokenDialog(null),
        onError: (error) =>
          setTokenDialog({
            ...tokenDialog,
            error: error instanceof Error ? error.message : 'Could not revoke tokens.',
          }),
      },
    );
  };

  return (
    <Screen contentTopPadding={28} refreshing={usersQuery.isRefetching} onRefresh={() => void usersQuery.refetch({ cancelRefetch: false })}>
      {confirmationDialog ? (
        <AppModal
          visible
          title={confirmationDialog.title}
          body={confirmationDialog.body}
          icon={confirmationDialog.icon}
          actions={confirmationDialog.actions}
          onRequestClose={() => setConfirmationDialog(null)}
        />
      ) : null}
      {tokenDialog ? (
        <AppModal
          visible
          title={tokenDialog.mode === 'grant' ? 'Grant Tokens' : 'Revoke Tokens'}
          body={
            tokenDialog.mode === 'grant'
              ? 'Grant promotional tokens to this contractor. The adjustment will be recorded in the wallet ledger and audit log.'
              : 'Revoke tokens from this contractor. The balance cannot go below zero and a reason is required.'
          }
          icon={tokenDialog.mode === 'grant' ? Coins : MinusCircle}
          media={
            <View style={styles.dialogFields}>
              <Text style={[styles.dialogMeta, { color: theme.colors.textMuted }]}>
                {tokenDialog.user.profile?.displayName ?? tokenDialog.user.email} / Balance:{' '}
                {tokenDialog.user.tokenBalance?.balance ?? 0}
              </Text>
              <TextField
                label="Amount"
                value={tokenDialog.amount}
                onChangeText={(amount) => setTokenDialog({ ...tokenDialog, amount, error: undefined })}
                keyboardType="number-pad"
                placeholder={tokenDialog.mode === 'grant' ? '10' : '5'}
              />
              <TextField
                label="Reason"
                value={tokenDialog.reason}
                onChangeText={(reason) => setTokenDialog({ ...tokenDialog, reason, error: undefined })}
                placeholder={tokenDialog.mode === 'grant' ? 'Launch promotion' : 'Correction'}
                multiline
              />
              {tokenDialog.error ? (
                <Text style={[styles.dialogError, { color: theme.colors.danger }]}>{tokenDialog.error}</Text>
              ) : null}
            </View>
          }
          actions={[
            { label: 'Cancel', variant: 'secondary', onPress: () => setTokenDialog(null) },
            {
              label: tokenDialog.mode === 'grant' ? 'Grant Tokens' : 'Revoke Tokens',
              variant: tokenDialog.mode === 'grant' ? 'primary' : 'danger',
              disabled: grantTokensMutation.isPending || revokeTokensMutation.isPending,
              onPress: submitTokenDialog,
            },
          ]}
          onRequestClose={() => setTokenDialog(null)}
        />
      ) : null}
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
          const canAdjustTokens = user.role === 'CONTRACTOR';
          const tokenBalance = user.tokenBalance?.balance ?? 0;

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
                {canAdjustTokens ? (
                  <>
                    <Button
                      title="Grant Tokens"
                      icon={Coins}
                      variant="primary"
                      loading={grantTokensMutation.isPending}
                      onPress={() => openTokenDialog('grant', user)}
                      style={styles.action}
                    />
                    <Button
                      title="Revoke Tokens"
                      icon={MinusCircle}
                      variant="secondary"
                      disabled={tokenBalance <= 0}
                      loading={revokeTokensMutation.isPending}
                      onPress={() => openTokenDialog('revoke', user)}
                      style={styles.action}
                    />
                  </>
                ) : null}
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
    flexWrap: 'wrap',
    gap: 10,
  },
  action: {
    flex: 1,
    minWidth: '47%',
  },
  dialogFields: {
    gap: 12,
  },
  dialogMeta: {
    fontSize: 13,
    lineHeight: 19,
  },
  dialogError: {
    fontSize: 13,
    fontWeight: '800',
  },
});
