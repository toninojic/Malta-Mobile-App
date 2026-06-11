import { CalendarClock, ChevronRight, Sparkles } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Badge } from './Badge';
import { Card } from './Card';
import { useTheme } from '../design/theme';
import { Offer } from '../types/domain';
import { formatDate } from '../utils/date';
import { completionStatusLabel, isCompletedOffer, primaryOfferActionLabel } from '../utils/offerWork';

export function OfferWorkCard({ offer, onPress }: { offer: Offer; onPress: () => void }) {
  const theme = useTheme();
  const job = offer.jobRequest;
  const badgeStatuses = getOfferBadgeStatuses(offer);
  const completed = isCompletedOffer(offer);
  const isSelectedActive = offer.status === 'SELECTED' && offer.unlockStatus !== 'UNLOCKED' && !completed;
  const showSelectedHistory = offer.selectedByEmployer && !isSelectedActive;
  const shouldShowUnlock = isSelectedActive;
  const isRejected = offer.status === 'REJECTED';
  const isClosedJob = offer.jobRequest?.status === 'CLOSED';
  const showNextAction = !isRejected && !isClosedJob;

  return (
    <Card
      onPress={onPress}
      style={[
        isSelectedActive
          ? {
              backgroundColor: `${theme.colors.primary}10`,
              borderColor: theme.colors.primary,
            }
          : null,
        isRejected || isClosedJob
          ? {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: isRejected ? theme.colors.danger : theme.colors.border,
              opacity: 0.72,
            }
          : null,
      ]}
    >
      {isSelectedActive ? (
        <View style={[styles.selectedNotice, { backgroundColor: `${theme.colors.primary}18`, borderColor: theme.colors.primary }]}>
          <Text style={[styles.selectedBadge, { color: theme.colors.primary }]}>SELECTED</Text>
          <Text style={[styles.selectedText, { color: theme.colors.text }]}>Selected by employer</Text>
        </View>
      ) : null}
      {showSelectedHistory ? (
        <Text style={[styles.historyText, { color: theme.colors.textMuted }]}>Selected by employer</Text>
      ) : null}

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
        {isClosedJob ? <Badge status="JOB CLOSED" /> : null}
        {badgeStatuses.filter((status) => !(isSelectedActive && status === 'SELECTED')).map((status) => (
          <Badge key={status} status={status} />
        ))}
      </View>
      {offer.employerRatingSummary?.totalReviews ? (
        <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
          Employer rating {Number(offer.employerRatingSummary.averageRating).toFixed(1)} ({offer.employerRatingSummary.totalReviews})
        </Text>
      ) : null}
      {offer.message ? (
        <Text numberOfLines={3} style={[styles.message, { color: theme.colors.textMuted }]}>
          {offer.message}
        </Text>
      ) : null}

      <View style={styles.row}>
        <CalendarClock color={theme.colors.textMuted} size={16} />
        <Text style={[styles.meta, { color: theme.colors.textMuted }]}>Starts {formatDate(offer.startDate)}</Text>
      </View>

      {showNextAction ? (
        <View
          style={[
            styles.nextAction,
            {
              backgroundColor: shouldShowUnlock ? theme.colors.primary : theme.colors.surfaceMuted,
              borderColor: shouldShowUnlock ? theme.colors.primary : theme.colors.border,
            },
          ]}
        >
          <Sparkles color={shouldShowUnlock ? '#FFFFFF' : theme.colors.primary} size={16} />
          <Text style={[styles.nextText, { color: shouldShowUnlock ? '#FFFFFF' : theme.colors.text }]}>{primaryOfferActionLabel(offer)}</Text>
        </View>
      ) : null}
    </Card>
  );
}

function getOfferBadgeStatuses(offer: Offer) {
  if (isCompletedOffer(offer)) {
    return ['COMPLETED'];
  }

  const statuses = [
    offer.status === 'SELECTED' && offer.unlockStatus === 'UNLOCKED' ? null : offer.status,
    offer.jobRequest?.status,
    offer.unlockStatus && offer.unlockStatus !== 'LOCKED' ? offer.unlockStatus : null,
    offer.completionStatus ? completionStatusLabel(offer.completionStatus) : null,
  ].filter(Boolean) as string[];

  return Array.from(new Set(statuses));
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
  message: {
    fontSize: 13,
    lineHeight: 19,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedNotice: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selectedBadge: {
    fontSize: 14,
    fontWeight: '900',
  },
  selectedText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  historyText: {
    fontSize: 13,
    fontWeight: '700',
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
