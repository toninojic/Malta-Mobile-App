import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Save } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { api } from '../../api/client';
import { cacheOffer, invalidateMarketplaceState } from '../../api/invalidation';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useTheme } from '../../design/theme';
import { JobsStackParamList } from '../../navigation/types';
import { OfferFormValues } from '../../types/domain';

type Props = NativeStackScreenProps<JobsStackParamList, 'OfferForm'>;

export function OfferFormScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { jobId, offerId } = route.params;
  const isEditing = Boolean(offerId);
  const [estimatedPrice, setEstimatedPrice] = useState('');
  const [estimatedCompletionDays, setEstimatedCompletionDays] = useState('');
  const [message, setMessage] = useState('');

  const offerQuery = useQuery({
    queryKey: ['offers', 'mine', 'form', offerId],
    queryFn: () => api.myOffers({ limit: 100 }),
    enabled: isEditing,
    refetchOnWindowFocus: true,
  });

  const existingOffer = useMemo(
    () => offerQuery.data?.data.find((offer) => offer.id === offerId),
    [offerId, offerQuery.data?.data],
  );

  useEffect(() => {
    if (!existingOffer) {
      return;
    }

    setEstimatedPrice(existingOffer.estimatedPrice);
    setEstimatedCompletionDays(String(existingOffer.estimatedCompletionDays));
    setMessage(existingOffer.message ?? '');
  }, [existingOffer]);

  const values = useMemo<OfferFormValues>(
    () => ({
      estimatedPrice: Number(estimatedPrice),
      estimatedCompletionDays: Number(estimatedCompletionDays),
      message: message.trim() ? message.trim() : undefined,
    }),
    [estimatedCompletionDays, estimatedPrice, message],
  );

  const mutation = useMutation({
    mutationFn: () => (offerId ? api.updateOffer(offerId, values) : api.createOffer(jobId, values)),
    onSuccess: async (offer) => {
      cacheOffer(queryClient, offer);
      await invalidateMarketplaceState(queryClient, {
        jobId: offer.jobRequestId,
        offerId: offer.id,
        contractorId: offer.contractorId,
      });
      navigation.goBack();
    },
    onError: (error) => {
      Alert.alert('Could not save offer', error instanceof Error ? error.message : 'Please check the form.');
    },
  });

  const submit = () => {
    if (!Number.isFinite(values.estimatedPrice) || values.estimatedPrice <= 0) {
      Alert.alert('Price needed', 'Add a valid estimated price.');
      return;
    }

    if (!Number.isInteger(values.estimatedCompletionDays) || values.estimatedCompletionDays < 1) {
      Alert.alert('Timeline needed', 'Add estimated completion time in days.');
      return;
    }

    mutation.mutate();
  };

  if (isEditing && offerQuery.isLoading) {
    return (
      <Screen>
        <EmptyState icon={Save} title="Loading offer" message="Fetching your current estimate." />
      </Screen>
    );
  }

  if (isEditing && offerQuery.error) {
    return (
      <Screen>
        <EmptyState
          icon={Save}
          title="Could not load offer"
          message={offerQuery.error instanceof Error ? offerQuery.error.message : 'Please try again.'}
          actionTitle="Retry"
          onAction={() => void offerQuery.refetch()}
        />
      </Screen>
    );
  }

  if (isEditing && offerQuery.data && !existingOffer) {
    return (
      <Screen>
        <EmptyState icon={Save} title="Offer unavailable" message="This offer could not be opened." />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{isEditing ? 'Edit offer' : 'Create offer'}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          Add a clear estimate for the employer to compare.
        </Text>
      </View>

      <TextField
        label="Estimated price"
        value={estimatedPrice}
        onChangeText={setEstimatedPrice}
        keyboardType="decimal-pad"
        placeholder="120"
      />
      <TextField
        label="Estimated completion days"
        value={estimatedCompletionDays}
        onChangeText={setEstimatedCompletionDays}
        keyboardType="number-pad"
        placeholder="3"
      />
      <TextField
        label="Message"
        value={message}
        onChangeText={setMessage}
        multiline
        placeholder="Optional note"
      />
      <Button title={isEditing ? 'Save Changes' : 'Submit Offer'} icon={Save} loading={mutation.isPending} onPress={submit} />
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
});
