import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Coins, ReceiptText, RefreshCw, RotateCcw } from 'lucide-react-native';
import { ReactNode } from 'react';
import { Alert, ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  useAdminRefunds,
  useMockPurchase,
  useMyRefunds,
  useTokenBalance,
  useTokenPackages,
  useTokenTransactions,
} from '../../api/tokenHooks';
import { BalanceCard } from '../../components/wallet/BalanceCard';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { PackageCard } from '../../components/wallet/PackageCard';
import { RefundCard } from '../../components/wallet/RefundCard';
import { Screen } from '../../components/Screen';
import { TransactionCard } from '../../components/wallet/TransactionCard';
import { useTheme } from '../../design/theme';
import { WalletStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/auth.store';

type Props = NativeStackScreenProps<WalletStackParamList, 'WalletHome'>;

export function WalletScreen({ navigation }: Props) {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';
  const packagesQuery = useTokenPackages();
  const balanceQuery = useTokenBalance();
  const transactionsQuery = useTokenTransactions();
  const refundsQuery = useMyRefunds();
  const adminRefundsQuery = useAdminRefunds(isAdmin);
  const purchaseMutation = useMockPurchase();

  const handleBuy = (tokenPackageId: string) => {
    purchaseMutation.mutate(tokenPackageId, {
      onSuccess: (result) => {
        Alert.alert('Package added', `Your wallet now has ${result.balance.balance} tokens.`);
      },
      onError: (error) => {
        Alert.alert('Could not buy package', error instanceof Error ? error.message : 'Please try again.');
      },
    });
  };

  const loading = packagesQuery.isLoading || balanceQuery.isLoading || transactionsQuery.isLoading || refundsQuery.isLoading;
  const firstError = packagesQuery.error ?? balanceQuery.error ?? transactionsQuery.error ?? refundsQuery.error;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Token wallet</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Mock purchases are instant and free during MVP development.</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : null}

      {firstError ? (
        <EmptyState
          icon={RefreshCw}
          title="Could not load wallet"
          message={firstError instanceof Error ? firstError.message : 'Please try again.'}
          actionTitle="Retry"
          onAction={() => {
            void packagesQuery.refetch();
            void balanceQuery.refetch();
            void transactionsQuery.refetch();
            void refundsQuery.refetch();
          }}
        />
      ) : null}

      <BalanceCard balance={balanceQuery.data} />
      <Section title="Token packages">
        {packagesQuery.data?.length === 0 ? (
          <EmptyState icon={Coins} title="No packages" message="Token packages are not available yet." />
        ) : null}
        {packagesQuery.data?.map((tokenPackage) => (
          <PackageCard
            key={tokenPackage.id}
            tokenPackage={tokenPackage}
            loading={purchaseMutation.isPending}
            onBuy={() => handleBuy(tokenPackage.id)}
          />
        ))}
      </Section>

      <Section title="Transaction history">
        {transactionsQuery.data?.data.length === 0 ? (
          <EmptyState icon={ReceiptText} title="No transactions" message="Purchases and refunds will appear here." />
        ) : null}
        {transactionsQuery.data?.data.map((transaction) => (
          <TransactionCard
            key={transaction.id}
            transaction={transaction}
            onRefund={
              transaction.type === 'PURCHASE'
                ? () => navigation.navigate('RefundRequest', { transactionId: transaction.id })
                : undefined
            }
          />
        ))}
      </Section>

      <Section title="My refund requests">
        {refundsQuery.data?.data.length === 0 ? (
          <EmptyState icon={RotateCcw} title="No refund requests" message="Requested refunds will be listed here." />
        ) : null}
        {refundsQuery.data?.data.map((refund) => (
          <RefundCard key={refund.id} refund={refund} />
        ))}
      </Section>

      {isAdmin ? (
        <Section title="Admin refund queue">
          {adminRefundsQuery.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : null}
          {adminRefundsQuery.data?.data.length === 0 ? (
            <EmptyState icon={RotateCcw} title="No admin refunds" message="Refund requests will appear here for review." />
          ) : null}
          {adminRefundsQuery.data?.data.map((refund) => (
            <RefundCard
              key={refund.id}
              refund={refund}
              onPress={() => navigation.navigate('AdminRefundDetails', { refundId: refund.id })}
            />
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
      {children}
    </View>
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
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
});
