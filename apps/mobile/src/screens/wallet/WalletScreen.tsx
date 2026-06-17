import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Coins, CreditCard, ReceiptText, RefreshCw, RotateCcw } from 'lucide-react-native';
import { ComponentType, ReactNode, useCallback, useState } from 'react';
import { Alert, ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  useAdminRefunds,
  useMyRefunds,
  useTokenBalance,
  useTokenPackages,
  useTokenTransactions,
} from '../../api/tokenHooks';
import { useMockPurchase, usePaymentConfig, usePayments, useRevenueCatPurchase } from '../../api/paymentHooks';
import { BalanceCard } from '../../components/wallet/BalanceCard';
import { AppModal } from '../../components/AppModal';
import { EmptyState } from '../../components/EmptyState';
import { PackageCard } from '../../components/wallet/PackageCard';
import { PaymentCard } from '../../components/wallet/PaymentCard';
import { RefundCard } from '../../components/wallet/RefundCard';
import { Screen } from '../../components/Screen';
import { TransactionCard } from '../../components/wallet/TransactionCard';
import { purchaseConfig } from '../../config/purchaseConfig';
import { useTheme } from '../../design/theme';
import { WalletStackParamList } from '../../navigation/types';
import { configureRevenueCatForCurrentUser } from '../../services/revenueCatPurchases';
import { useAuthStore } from '../../store/auth.store';
import { TokenPackage } from '../../types/domain';

type Props = NativeStackScreenProps<WalletStackParamList, 'WalletHome'>;

type InfoDialog = {
  title: string;
  body: string;
  icon: ComponentType<{ color?: string; size?: number }>;
};

export function WalletScreen({ navigation }: Props) {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const [infoDialog, setInfoDialog] = useState<InfoDialog | null>(null);
  const isAdmin = user?.role === 'ADMIN';
  const packagesQuery = useTokenPackages();
  const balanceQuery = useTokenBalance();
  const transactionsQuery = useTokenTransactions();
  const refundsQuery = useMyRefunds();
  const paymentsQuery = usePayments();
  const paymentConfigQuery = usePaymentConfig();
  const adminRefundsQuery = useAdminRefunds(isAdmin);
  const revenueCatPurchaseMutation = useRevenueCatPurchase();
  const mockPurchaseMutation = useMockPurchase();
  const backendAllowsMock =
    paymentConfigQuery.data?.allowMockPurchases === true ||
    paymentConfigQuery.data?.mockPurchasesEnabled === true ||
    paymentConfigQuery.data?.mode === 'MOCK';
  const isMockMode = purchaseConfig.allowMockPurchases && backendAllowsMock;
  const isRevenueCatMode = paymentConfigQuery.data?.mode === 'REVENUECAT';

  useFocusEffect(
    useCallback(() => {
      void configureRevenueCatForCurrentUser({ forceDiagnostics: true });
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

  const handleBuy = async (tokenPackage: TokenPackage) => {
    const latestConfigResult = await paymentConfigQuery.refetch({ cancelRefetch: false });
    const paymentConfig = latestConfigResult.data ?? paymentConfigQuery.data;
    const shouldUseMock = purchaseConfig.allowMockPurchases && (
      paymentConfig?.allowMockPurchases === true ||
      paymentConfig?.mockPurchasesEnabled === true ||
      paymentConfig?.mode === 'MOCK'
    );
    const shouldUseRevenueCat = paymentConfig?.revenueCatConfigured === true || paymentConfig?.mode === 'REVENUECAT';

    if (shouldUseMock) {
      mockPurchaseMutation.mutate(tokenPackage.id, {
        onSuccess: (result) => {
          setInfoDialog({
            title: 'Package Added',
            body: `Your wallet now has ${result.balance.balance} tokens.`,
            icon: Coins,
          });
        },
        onError: (error) => {
          Alert.alert('Could not buy package', error instanceof Error ? error.message : 'Please try again.');
        },
      });
      return;
    }

    if (!shouldUseRevenueCat || !paymentConfig?.purchasesConfigured || paymentConfig.mode === 'UNCONFIGURED') {
      setInfoDialog({
        title: 'Purchases Not Configured',
        body: 'Purchases are not configured.',
        icon: CreditCard,
      });
      return;
    }

    revenueCatPurchaseMutation.mutate(tokenPackage, {
      onSuccess: () => {
        setInfoDialog({
          title: 'Purchase Processing',
          body: 'Your tokens will appear shortly after the purchase is verified.',
          icon: CreditCard,
        });
      },
      onError: (error) => {
        setInfoDialog({
          title: 'Purchase Unavailable',
          body: error instanceof Error ? error.message : 'Purchases are not configured.',
          icon: CreditCard,
        });
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

  const refreshing =
    packagesQuery.isRefetching ||
    balanceQuery.isRefetching ||
    transactionsQuery.isRefetching ||
    refundsQuery.isRefetching ||
    paymentsQuery.isRefetching ||
    paymentConfigQuery.isRefetching ||
    adminRefundsQuery.isRefetching;

  const refreshWallet = () => {
    if (!packagesQuery.isFetching) void packagesQuery.refetch({ cancelRefetch: false });
    if (!balanceQuery.isFetching) void balanceQuery.refetch({ cancelRefetch: false });
    if (!transactionsQuery.isFetching) void transactionsQuery.refetch({ cancelRefetch: false });
    if (!refundsQuery.isFetching) void refundsQuery.refetch({ cancelRefetch: false });
    if (!paymentsQuery.isFetching) void paymentsQuery.refetch({ cancelRefetch: false });
    if (!paymentConfigQuery.isFetching) void paymentConfigQuery.refetch({ cancelRefetch: false });
    if (isAdmin && !adminRefundsQuery.isFetching) void adminRefundsQuery.refetch({ cancelRefetch: false });
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refreshWallet}>
      {infoDialog ? (
        <AppModal
          visible
          title={infoDialog.title}
          body={infoDialog.body}
          icon={infoDialog.icon}
          actions={[{ label: 'Close', variant: 'primary', onPress: () => setInfoDialog(null) }]}
          onRequestClose={() => setInfoDialog(null)}
        />
      ) : null}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Token wallet</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          {isMockMode
            ? 'Mock purchase mode is enabled. Packages add tokens instantly for development testing.'
            : isRevenueCatMode
              ? 'Native purchases are verified by RevenueCat. Tokens appear after the backend receives the webhook.'
              : 'Purchases are not configured. Enable mock purchases for development or configure RevenueCat for store builds.'}
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
            loading={revenueCatPurchaseMutation.isPending || mockPurchaseMutation.isPending}
            modeLabel={isMockMode ? 'MOCK MODE' : isRevenueCatMode ? 'NATIVE PURCHASE' : 'NOT CONFIGURED'}
            onBuy={() => handleBuy(tokenPackage)}
          />
        ))}
      </Section>

      <Section title="Purchase history">
        {paymentsQuery.data?.data.length === 0 ? (
          <EmptyState icon={CreditCard} title="No purchases" message="Token purchases will appear here." />
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
