import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react-native';
import { ComponentType, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useAdminRefunds, useApproveRefund, useRejectRefund } from '../../api/tokenHooks';
import { AppModal } from '../../components/AppModal';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { RefundCard } from '../../components/wallet/RefundCard';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useTheme } from '../../design/theme';
import { WalletStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'AdminRefundDetails'>;

type StatusDialog = {
  title: string;
  body: string;
  icon: ComponentType<{ color?: string; size?: number }>;
};

export function AdminRefundDetailsScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const [adminNote, setAdminNote] = useState('');
  const [statusDialog, setStatusDialog] = useState<StatusDialog | null>(null);
  const refundsQuery = useAdminRefunds(true);
  const approveMutation = useApproveRefund();
  const rejectMutation = useRejectRefund();
  const refund = useMemo(
    () => refundsQuery.data?.data.find((item) => item.id === route.params.refundId),
    [refundsQuery.data?.data, route.params.refundId],
  );

  const handleApprove = () => {
    approveMutation.mutate(
      { refundRequestId: route.params.refundId, adminNote: adminNote.trim() || undefined },
      {
        onSuccess: () => {
          setStatusDialog({
            title: 'Refund Approved',
            body: 'Tokens were removed and the refund transaction was recorded.',
            icon: CheckCircle2,
          });
        },
        onError: (error) => {
          Alert.alert('Could not approve refund', error instanceof Error ? error.message : 'Please try again.');
        },
      },
    );
  };

  const handleReject = () => {
    rejectMutation.mutate(
      { refundRequestId: route.params.refundId, adminNote: adminNote.trim() || undefined },
      {
        onSuccess: () => {
          setStatusDialog({
            title: 'Refund Rejected',
            body: 'The request was marked as rejected.',
            icon: XCircle,
          });
        },
        onError: (error) => {
          Alert.alert('Could not reject refund', error instanceof Error ? error.message : 'Please try again.');
        },
      },
    );
  };

  if (refundsQuery.isLoading) {
    return (
      <Screen contentTopPadding={28}>
        <EmptyState icon={RefreshCw} title="Loading refund" message="Fetching request details." />
      </Screen>
    );
  }

  if (!refund) {
    return (
      <Screen contentTopPadding={28}>
        <EmptyState
          icon={RefreshCw}
          title="Refund unavailable"
          message="This refund request could not be opened."
          actionTitle="Retry"
          onAction={() => void refundsQuery.refetch()}
        />
      </Screen>
    );
  }

  const isPending = refund.status === 'PENDING';

  return (
    <Screen contentTopPadding={28}>
      {statusDialog ? (
        <AppModal
          visible
          title={statusDialog.title}
          body={statusDialog.body}
          icon={statusDialog.icon}
          actions={[{ label: 'Close', variant: 'primary', onPress: () => navigation.goBack() }]}
          onRequestClose={() => navigation.goBack()}
        />
      ) : null}
      <RefundCard refund={refund} />
      <Card>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Purchase transaction</Text>
        <Text style={[styles.copy, { color: theme.colors.textMuted }]}>
          {refund.tokenTransaction?.description ?? 'Purchase'} / {refund.amount} tokens
        </Text>
        <Text style={[styles.copy, { color: theme.colors.textMuted }]}>
          User: {refund.requestedBy?.email ?? refund.userId}
        </Text>
      </Card>
      <TextField label="Admin note" value={adminNote} onChangeText={setAdminNote} multiline placeholder="Optional note" />
      <View style={styles.actions}>
        <Button
          title="Approve"
          icon={CheckCircle2}
          disabled={!isPending}
          loading={approveMutation.isPending}
          onPress={handleApprove}
          style={styles.actionButton}
        />
        <Button
          title="Reject"
          icon={XCircle}
          variant="danger"
          disabled={!isPending}
          loading={rejectMutation.isPending}
          onPress={handleReject}
          style={styles.actionButton}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  copy: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
});
