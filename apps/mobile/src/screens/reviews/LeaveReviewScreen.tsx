import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SendHorizontal, Star } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useCreateReview } from '../../api/reviewHooks';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { RatingInput } from '../../components/reviews/RatingInput';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useTheme } from '../../design/theme';
import { ActivityStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ActivityStackParamList, 'LeaveReview'>;

export function LeaveReviewScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const mutation = useCreateReview();

  const submit = () => {
    mutation.mutate(
      {
        contactId: route.params.contactId,
        rating,
        comment: comment.trim() || undefined,
      },
      {
        onSuccess: (review) => {
          Alert.alert('Review submitted', 'The contractor has been notified.');
          navigation.replace('ReviewDetails', { reviewId: review.id });
        },
        onError: (error) => {
          Alert.alert('Could not submit review', error instanceof Error ? error.message : 'Please try again.');
        },
      },
    );
  };

  return (
    <Screen>
      <Card>
        <View style={styles.header}>
          <Star color={theme.colors.warning} fill={theme.colors.warning} size={24} />
          <View style={styles.copy}>
            <Text style={[styles.title, { color: theme.colors.text }]}>Leave a review</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
              Rate the completed job and optionally add a short comment.
            </Text>
          </View>
        </View>
        <RatingInput value={rating} onChange={setRating} disabled={mutation.isPending} />
        <TextField
          label="Comment"
          value={comment}
          onChangeText={setComment}
          maxLength={1500}
          multiline
          placeholder="Optional"
        />
        <Button title="Submit Review" icon={SendHorizontal} loading={mutation.isPending} onPress={submit} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  copy: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
});
