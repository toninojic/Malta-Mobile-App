import { StyleSheet, Text, View } from 'react-native';
import { Badge } from '../Badge';
import { Card } from '../Card';
import { useTheme } from '../../design/theme';
import { RefundRequest } from '../../types/domain';
import { formatDate } from '../../utils/date';

export function RefundCard({
  refund,
  onPress,
}: {
  refund: RefundRequest;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const createdAt = formatDate(refund.createdAt);

  return (
    <Card onPress={onPress}>
      <View style={styles.top}>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{refund.amount} token refund</Text>
          <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
            {createdAt}
            {refund.requestedBy?.email ? ` / ${refund.requestedBy.email}` : ''}
          </Text>
        </View>
        <Badge status={refund.status} />
      </View>
      <Text numberOfLines={2} style={[styles.reason, { color: theme.colors.textMuted }]}>
        {refund.reason}
      </Text>
      {refund.adminNote ? (
        <Text numberOfLines={2} style={[styles.note, { color: theme.colors.textMuted }]}>
          Admin note: {refund.adminNote}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
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
  },
  reason: {
    fontSize: 14,
    lineHeight: 20,
  },
  note: {
    fontSize: 13,
    lineHeight: 19,
  },
});
