import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RefreshCw, Star } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useContractorRatingSummary, useContractorReviews } from '../../api/reviewHooks';
import { EmptyState } from '../../components/EmptyState';
import { RatingSummaryCard } from '../../components/reviews/RatingSummaryCard';
import { ReviewCard } from '../../components/reviews/ReviewCard';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../design/theme';
import { ActivityStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/auth.store';

type Props = NativeStackScreenProps<ActivityStackParamList, 'MyReviews'>;

export function MyReviewsScreen({ navigation }: Props) {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const reviewsQuery = useContractorReviews(user?.id);
  const summaryQuery = useContractorRatingSummary(user?.id);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>My reviews</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Ratings from confirmed completed jobs.</Text>
      </View>

      <RatingSummaryCard summary={summaryQuery.data} />

      {reviewsQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : null}

      {reviewsQuery.error ? (
        <EmptyState
          icon={RefreshCw}
          title="Could not load reviews"
          message={reviewsQuery.error instanceof Error ? reviewsQuery.error.message : 'Please try again.'}
          actionTitle="Retry"
          onAction={() => void reviewsQuery.refetch()}
        />
      ) : null}

      {reviewsQuery.data?.data.length === 0 ? (
        <EmptyState icon={Star} title="No reviews yet" message="Completed job reviews will appear here." />
      ) : null}

      <View style={styles.list}>
        {reviewsQuery.data?.data.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            onPress={() => navigation.navigate('ReviewDetails', { reviewId: review.id })}
          />
        ))}
      </View>
    </Screen>
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
  list: {
    gap: 12,
  },
});
