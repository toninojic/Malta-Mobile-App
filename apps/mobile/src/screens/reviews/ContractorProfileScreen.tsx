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

type Props = NativeStackScreenProps<ActivityStackParamList, 'ContractorProfile'>;

export function ContractorProfileScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const summaryQuery = useContractorRatingSummary(route.params.contractorId);
  const reviewsQuery = useContractorReviews(route.params.contractorId);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Contractor profile</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Rating summary and completed job reviews.</Text>
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
          title="Could not load profile"
          message={reviewsQuery.error instanceof Error ? reviewsQuery.error.message : 'Please try again.'}
          actionTitle="Retry"
          onAction={() => void reviewsQuery.refetch()}
        />
      ) : null}

      {reviewsQuery.data?.data.length === 0 ? (
        <EmptyState icon={Star} title="No reviews yet" message="This contractor has no active reviews yet." />
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
