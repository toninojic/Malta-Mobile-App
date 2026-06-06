import { CreditCard } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../design/theme';
import { Payment } from '../../types/domain';
import { formatDate } from '../../utils/date';
import { Badge } from '../Badge';
import { Card } from '../Card';

export function PaymentCard({ payment }: { payment: Payment }) {
  const theme = useTheme();
  const createdAt = formatDate(payment.createdAt);

  return (
    <Card>
      <View style={styles.top}>
        <View style={[styles.iconWrap, { backgroundColor: `${theme.colors.primary}18` }]}>
          <CreditCard color={theme.colors.primary} size={18} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{payment.tokenPackage.title}</Text>
          <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
            {payment.amount} {payment.currency} / {payment.tokenPackage.tokenCount} tokens / {createdAt}
          </Text>
        </View>
        <Badge status={payment.status} />
      </View>
      {payment.failureReason ? (
        <Text style={[styles.failure, { color: theme.colors.danger }]}>{payment.failureReason}</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  top: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
  },
  failure: {
    fontSize: 13,
    lineHeight: 18,
  },
});
