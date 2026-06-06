import { CalendarClock, ChevronRight, Sparkles } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Badge } from './Badge';
import { Card } from './Card';
import { useTheme } from '../design/theme';
import { Offer } from '../types/domain';
import { formatDate } from '../utils/date';
import { completionStatusLabel, primaryOfferActionLabel } from '../utils/offerWork';

export function OfferWorkCard({ offer, onPress }: { offer: Offer; onPress: () => void }) {
  const theme = useTheme();
  const job = offer.jobRequest;

  return (
    <Card onPress={onPress}>
      <View style={styles.top}>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{job?.title ?? 'Job request'}</Text>
          <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
            EUR {offer.estimatedPrice} / {offer.estimatedCompletionDays} days
          </Text>
        </View>
        <ChevronRight color={theme.colors.textMuted} size={20} />
      </View>

      <View style={styles.badges}>
        <Badge status={offer.status} />
        {job?.status ? <Badge status={job.status} /> : null}
        {offer.unlockStatus && offer.unlockStatus !== 'LOCKED' ? <Badge status={offer.unlockStatus} /> : null}
        {offer.completionStatus ? <Badge status={completionStatusLabel(offer.completionStatus)} /> : null}
      </View>

      <View style={styles.row}>
        <CalendarClock color={theme.colors.textMuted} size={16} />
        <Text style={[styles.meta, { color: theme.colors.textMuted }]}>Starts {formatDate(offer.startDate)}</Text>
      </View>

      <View style={[styles.nextAction, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
        <Sparkles color={theme.colors.primary} size={16} />
        <Text style={[styles.nextText, { color: theme.colors.text }]}>{primaryOfferActionLabel(offer)}</Text>
      </View>
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
    fontSize: 13,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextAction: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  nextText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
});
