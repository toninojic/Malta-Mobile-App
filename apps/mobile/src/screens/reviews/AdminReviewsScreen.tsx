import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RefreshCw, ShieldCheck } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAdminReviews } from '../../api/reviewHooks';
import { EmptyState } from '../../components/EmptyState';
import { ReviewCard } from '../../components/reviews/ReviewCard';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../design/theme';
import { ActivityStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ActivityStackParamList, 'AdminReviews'>;

export function AdminReviewsScreen({ navigation }: Props) {
  const theme = useTheme();
  const query = useAdminReviews(true);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Review moderation</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>View and remove marketplace reviews.</Text>
      </View>

      {query.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : null}

      {query.error ? (
        <EmptyState
          icon={RefreshCw}
          title="Could not load reviews"
          message={query.error instanceof Error ? query.error.message : 'Please try again.'}
          actionTitle="Retry"
          onAction={() => void query.refetch()}
        />
      ) : null}

      {query.data?.data.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No reviews" message="Reviews will appear here for moderation." />
      ) : null}

      <View style={styles.list}>
        {query.data?.data.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            onPress={() => navigation.navigate('ReviewDetails', { reviewId: review.id, admin: true })}
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
