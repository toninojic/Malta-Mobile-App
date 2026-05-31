import { Coins } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../design/theme';
import { TokenBalance } from '../../types/domain';
import { Card } from '../Card';

export function BalanceCard({ balance }: { balance?: TokenBalance }) {
  const theme = useTheme();

  return (
    <Card>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: `${theme.colors.primary}18` }]}>
          <Coins color={theme.colors.primary} size={24} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.label, { color: theme.colors.textMuted }]}>Token balance</Text>
          <Text style={[styles.value, { color: theme.colors.text }]}>{balance?.balance ?? 0}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  value: {
    fontSize: 34,
    fontWeight: '900',
  },
});
