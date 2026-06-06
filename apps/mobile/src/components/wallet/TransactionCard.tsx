import { RefreshCcw } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { Card } from '../Card';
import { useTheme } from '../../design/theme';
import { TokenTransaction } from '../../types/domain';
import { formatDate } from '../../utils/date';

export function TransactionCard({
  transaction,
  onRefund,
}: {
  transaction: TokenTransaction;
  onRefund?: () => void;
}) {
  const theme = useTheme();
  const createdAt = formatDate(transaction.createdAt);
  const canRefund = transaction.type === 'PURCHASE' && transaction.amount > 0 && onRefund;

  return (
    <Card>
      <View style={styles.top}>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{transaction.description}</Text>
          <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
            {createdAt} / balance after {transaction.balanceAfter}
          </Text>
        </View>
        <Badge status={transaction.type} />
      </View>
      <Text style={[styles.amount, { color: transaction.amount >= 0 ? theme.colors.primary : theme.colors.danger }]}>
        {transaction.amount >= 0 ? '+' : ''}
        {transaction.amount} tokens
      </Text>
      {canRefund ? <Button title="Request Refund" icon={RefreshCcw} variant="secondary" onPress={onRefund} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  meta: {
    fontSize: 13,
  },
  amount: {
    fontSize: 18,
    fontWeight: '900',
  },
});
