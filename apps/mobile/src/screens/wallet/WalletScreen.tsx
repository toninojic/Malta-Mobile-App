import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Coins, CreditCard, ReceiptText, RefreshCw, RotateCcw } from 'lucide-react-native';
import { ReactNode, useCallback } from 'react';
import { Alert, ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import {
  useAdminRefunds,
  useMyRefunds,
  useTokenBalance,
  useTokenPackages,
  useTokenTransactions,
} from '../../api/tokenHooks';
import { useCreateCheckoutSession, useMockPurchase, usePaymentConfig, usePayments } from '../../api/paymentHooks';
import { BalanceCard } from '../../components/wallet/BalanceCard';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { PackageCard } from '../../components/wallet/PackageCard';
import { PaymentCard } from '../../components/wallet/PaymentCard';
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
  const paymentsQuery = usePayments();
  const paymentConfigQuery = usePaymentConfig();
  const adminRefundsQuery = useAdminRefunds(isAdmin);
  const checkoutMutation = useCreateCheckoutSession();
  const mockPurchaseMutation = useMockPurchase();
  const isMockMode = paymentConfigQuery.data?.mode === 'MOCK';

  useFocusEffect(
    useCallback(() => {
      void packagesQuery.refetch({ cancelRefetch: false });
      void balanceQuery.refetch({ cancelRefetch: false });
      void transactionsQuery.refetch({ cancelRefetch: false });
      void refundsQuery.refetch({ cancelRefetch: false });
      void paymentsQuery.refetch({ cancelRefetch: false });
      void paymentConfigQuery.refetch({ cancelRefetch: false });
      if (isAdmin) {
        void adminRefundsQuery.refetch({ cancelRefetch: false });
      }
    }, [
      adminRefundsQuery.refetch,
      balanceQuery.refetch,
      isAdmin,
      packagesQuery.refetch,
      paymentConfigQuery.refetch,
      paymentsQuery.refetch,
      refundsQuery.refetch,
      transactionsQuery.refetch,
    ]),
  );

  const handleBuy = (tokenPackageId: string) => {
    if (isMockMode) {
      mockPurchaseMutation.mutate(tokenPackageId, {
        onSuccess: (result) => {
          Alert.alert('Package added', `Your wallet now has ${result.balance.balance} tokens.`);
        },
        onError: (error) => {
          Alert.alert('Could not buy package', error instanceof Error ? error.message : 'Please try again.');
        },
      });
      return;
    }

    checkoutMutation.mutate(tokenPackageId, {
      onSuccess: async (result) => {
        try {
          await Linking.openURL(result.checkoutUrl);
        } catch {
          Alert.alert('Checkout ready', 'Stripe checkout could not be opened on this device.');
        }
      },
      onError: (error) => {
        Alert.alert('Could not open checkout', error instanceof Error ? error.message : 'Payments are not configured.');
      },
    });
  };

  const loading =
    packagesQuery.isLoading ||
    balanceQuery.isLoading ||
    transactionsQuery.isLoading ||
    refundsQuery.isLoading ||
    paymentsQuery.isLoading ||
    paymentConfigQuery.isLoading;
  const firstError =
    packagesQuery.error ??
    balanceQuery.error ??
    transactionsQuery.error ??
    refundsQuery.error ??
    paymentsQuery.error ??
    paymentConfigQuery.error;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Token wallet</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          {isMockMode
            ? 'Mock purchase mode is enabled. Packages add tokens instantly for development testing.'
            : 'Stripe test checkout opens in the browser. Tokens are added after the webhook confirms payment.'}
        </Text>
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
            void paymentsQuery.refetch();
            void paymentConfigQuery.refetch();
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
            loading={checkoutMutation.isPending || mockPurchaseMutation.isPending}
            modeLabel={isMockMode ? 'MOCK MODE' : 'TEST MODE'}
            onBuy={() => handleBuy(tokenPackage.id)}
          />
        ))}
      </Section>

      <Section title="Payment history">
        {paymentsQuery.data?.data.length === 0 ? (
          <EmptyState icon={CreditCard} title="No payments" message="Stripe checkout attempts will appear here." />
        ) : null}
        {paymentsQuery.data?.data.map((payment) => (
          <PaymentCard key={payment.id} payment={payment} />
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
