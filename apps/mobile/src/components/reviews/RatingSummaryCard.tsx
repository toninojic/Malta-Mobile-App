import { Star } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../design/theme';
import { ContractorRatingSummary } from '../../types/domain';
import { Card } from '../Card';

export function RatingSummaryCard({ summary }: { summary?: ContractorRatingSummary }) {
  const theme = useTheme();
  const average = Number(summary?.averageRating ?? 0).toFixed(1);
  const total = summary?.totalReviews ?? 0;

  return (
    <Card>
      <View style={styles.row}>
        <Star color={theme.colors.warning} fill={theme.colors.warning} size={26} />
        <View style={styles.copy}>
          <Text style={[styles.value, { color: theme.colors.text }]}>{average}</Text>
          <Text style={[styles.label, { color: theme.colors.textMuted }]}>
            {total} {total === 1 ? 'review' : 'reviews'}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  copy: {
    gap: 2,
  },
  value: {
    fontSize: 26,
    fontWeight: '900',
  },
  label: {
    fontSize: 14,
  },
});
