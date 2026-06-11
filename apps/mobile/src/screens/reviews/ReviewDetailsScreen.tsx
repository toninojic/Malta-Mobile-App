import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { MessageSquareReply, RefreshCw, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useEmployerReview, useRemoveReview, useReplyReview, useReview } from '../../api/reviewHooks';
import { AppModal } from '../../components/AppModal';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useTheme } from '../../design/theme';
import { ActivityStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/auth.store';

type Props = NativeStackScreenProps<ActivityStackParamList, 'ReviewDetails'>;

export function ReviewDetailsScreen({ route }: Props) {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const isAdmin = route.params.admin || user?.role === 'ADMIN';
  const isEmployerReview = route.params.target === 'employer';
  const contractorReviewQuery = useReview(route.params.reviewId, Boolean(isAdmin), !isEmployerReview);
  const employerReviewQuery = useEmployerReview(route.params.reviewId, isEmployerReview);
  const query = isEmployerReview ? employerReviewQuery : contractorReviewQuery;
  const replyMutation = useReplyReview();
  const removeMutation = useRemoveReview();
  const [reply, setReply] = useState('');
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void query.refetch({ cancelRefetch: false });
    }, [query.refetch]),
  );

  if (query.error || !query.data) {
    return (
      <Screen>
        <EmptyState
          icon={RefreshCw}
          title={query.isLoading ? 'Loading review' : 'Could not load review'}
          message={query.error instanceof Error ? query.error.message : 'Fetching review details.'}
          actionTitle={query.error ? 'Retry' : undefined}
          onAction={query.error ? () => void query.refetch() : undefined}
        />
      </Screen>
    );
  }

  const review = query.data;
  const contractorReply =
    'contractorReply' in review && typeof review.contractorReply === 'string' ? review.contractorReply : null;
  const canReply =
    !isEmployerReview &&
    user?.role === 'CONTRACTOR' &&
    review.contractorId === user.id &&
    !contractorReply &&
    review.status === 'ACTIVE';
  const canRemove = !isEmployerReview && isAdmin && review.status === 'ACTIVE';

  const submitReply = () => {
    const trimmed = reply.trim();
    if (!trimmed) {
      Alert.alert('Reply needed', 'Write a short reply before submitting.');
      return;
    }

    replyMutation.mutate(
      { reviewId: review.id, contractorReply: trimmed },
      {
        onSuccess: () => {
          setReply('');
          void query.refetch();
        },
        onError: (error) => {
          Alert.alert('Could not reply', error instanceof Error ? error.message : 'Please try again.');
        },
      },
    );
  };

  const removeReview = () => {
    setRemoveDialogOpen(true);
  };

  return (
    <Screen>
      <AppModal
        visible={removeDialogOpen}
        title="Remove Review"
        body="Removed reviews stay in the database but no longer count toward ratings."
        icon={Trash2}
        actions={[
          { label: 'Cancel', variant: 'secondary', onPress: () => setRemoveDialogOpen(false) },
          {
            label: 'Remove',
            variant: 'danger',
            onPress: () => {
              setRemoveDialogOpen(false);
              removeMutation.mutate(review.id, {
                onSuccess: () => void query.refetch(),
                onError: (error) => {
                  Alert.alert('Could not remove review', error instanceof Error ? error.message : 'Please try again.');
                },
              });
            },
          },
        ]}
        onRequestClose={() => setRemoveDialogOpen(false)}
      />
      <Card>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: theme.colors.text }]}>{review.jobRequest?.title ?? 'Review'}</Text>
            <Text style={[styles.rating, { color: theme.colors.text }]}>{review.rating}/5 stars</Text>
          </View>
          <Badge status={review.status} />
        </View>
        {review.comment ? (
          <Text style={[styles.body, { color: theme.colors.textMuted }]}>{review.comment}</Text>
        ) : (
          <Text style={[styles.body, { color: theme.colors.textMuted }]}>No comment was added.</Text>
        )}
        <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
          Employer: {review.employer?.profile?.displayName ?? review.employer?.email ?? review.employerId}
        </Text>
        <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
          Contractor: {review.contractor?.profile?.displayName ?? review.contractor?.email ?? review.contractorId}
        </Text>
      </Card>

      {!isEmployerReview && contractorReply ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Contractor reply</Text>
          <Text style={[styles.body, { color: theme.colors.textMuted }]}>{contractorReply}</Text>
        </Card>
      ) : null}

      {canReply ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Reply once</Text>
          <TextField
            label="Reply"
            value={reply}
            onChangeText={setReply}
            maxLength={1500}
            multiline
            placeholder="Write a professional reply"
          />
          <Button title="Send Reply" icon={MessageSquareReply} loading={replyMutation.isPending} onPress={submitReply} />
        </Card>
      ) : null}

      {canRemove ? (
        <Button title="Remove Review" icon={Trash2} variant="danger" loading={removeMutation.isPending} onPress={removeReview} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
  },
  rating: {
    fontSize: 18,
    fontWeight: '900',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  meta: {
    fontSize: 13,
  },
});
