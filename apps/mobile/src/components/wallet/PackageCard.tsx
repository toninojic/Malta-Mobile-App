import { ShoppingBag } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../design/theme';
import { TokenPackage } from '../../types/domain';
import { Button } from '../Button';
import { Card } from '../Card';

export function PackageCard({
  tokenPackage,
  loading,
  onBuy,
}: {
  tokenPackage: TokenPackage;
  loading?: boolean;
  onBuy: () => void;
}) {
  const theme = useTheme();

  return (
    <Card>
      <View style={styles.top}>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{tokenPackage.title}</Text>
          <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
            {tokenPackage.tokenCount} tokens / {tokenPackage.price} {tokenPackage.currency}
          </Text>
        </View>
        <Text style={[styles.badge, { color: theme.colors.primary, borderColor: theme.colors.primary }]}>FREE MVP</Text>
      </View>
      <Button title="Buy Package" icon={ShoppingBag} loading={loading} onPress={onBuy} />
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
    fontSize: 18,
    fontWeight: '900',
  },
  meta: {
    fontSize: 14,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
});
