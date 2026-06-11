import { Star } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../design/theme';
import { EmployerReview, Review } from '../../types/domain';
import { formatDate } from '../../utils/date';
import { Badge } from '../Badge';
import { Card } from '../Card';

type ReviewCardProps = {
  review: Review | EmployerReview;
  onPress?: () => void;
};

export function ReviewCard({ review, onPress }: ReviewCardProps) {
  const theme = useTheme();

  return (
    <Card onPress={onPress}>
      <View style={styles.top}>
        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {review.jobRequest?.title ?? 'Completed job'}
          </Text>
          <View style={styles.rating}>
            <Star color={theme.colors.warning} fill={theme.colors.warning} size={16} />
            <Text style={[styles.meta, { color: theme.colors.textMuted }]}>{review.rating}/5</Text>
          </View>
        </View>
        <Badge status={review.status} />
      </View>
      {review.comment ? (
        <Text style={[styles.body, { color: theme.colors.textMuted }]}>{review.comment}</Text>
      ) : null}
      {'contractorReply' in review && review.contractorReply ? (
        <View style={[styles.reply, { borderColor: theme.colors.border }]}>
          <Text style={[styles.replyLabel, { color: theme.colors.text }]}>Contractor reply</Text>
          <Text style={[styles.body, { color: theme.colors.textMuted }]}>{review.contractorReply}</Text>
        </View>
      ) : null}
      <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
        {formatDate(review.createdAt)}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  titleWrap: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
  },
  meta: {
    fontSize: 13,
  },
  reply: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
    paddingTop: 10,
  },
  replyLabel: {
    fontSize: 13,
    fontWeight: '900',
  },
});
