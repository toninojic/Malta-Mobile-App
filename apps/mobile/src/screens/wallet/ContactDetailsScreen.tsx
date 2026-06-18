import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { CheckCircle2, ClipboardCheck, Mail, MessageCircle, Phone, RefreshCw, Star, UserRound } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useContact } from '../../api/contactHooks';
import { useEnsureConversationForContact } from '../../api/messageHooks';
import { useCompleteContact, useCompletionStatus, useConfirmCompletion } from '../../api/reviewHooks';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { AppModal } from '../../components/AppModal';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../design/theme';
import { ActivityStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/auth.store';
import { AuthUser } from '../../types/domain';

type Props = NativeStackScreenProps<ActivityStackParamList, 'ContactDetails'>;

export function ContactDetailsScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const query = useContact(route.params.contactId, Boolean(route.params.admin));
  const completionQuery = useCompletionStatus(route.params.contactId);
  const ensureConversationMutation = useEnsureConversationForContact();
  const completeMutation = useCompleteContact();
  const confirmMutation = useConfirmCompletion();
  const [completionInfo, setCompletionInfo] = useState<{ title: string; body: string; jobId?: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      void query.refetch({ cancelRefetch: false });
      void completionQuery.refetch({ cancelRefetch: false });
    }, [completionQuery.refetch, query.refetch]),
  );

  if (query.error || !query.data) {
    return (
      <Screen>
        <EmptyState
          icon={RefreshCw}
          title={query.isLoading ? 'Loading contact' : 'Could not load contact'}
          message={query.error instanceof Error ? query.error.message : 'Fetching contact details.'}
          actionTitle={query.error ? 'Retry' : undefined}
          onAction={query.error ? () => void query.refetch() : undefined}
        />
      </Screen>
    );
  }

  const contact = query.data;
  const completion = completionQuery.data;
  const completionStatus = completion?.status ?? 'NOT_STARTED';
  const isAdminView = Boolean(route.params.admin);
  const isContractor = user?.role === 'CONTRACTOR' && contact.contractorId === user.id;
  const isEmployer = user?.role === 'EMPLOYER' && contact.employerId === user.id;

  const markComplete = () => {
    completeMutation.mutate(contact.id, {
      onSuccess: async () => {
        await completionQuery.refetch({ cancelRefetch: false });
        await query.refetch({ cancelRefetch: false });
        setCompletionInfo({ title: 'Completion Requested', body: 'The employer has been notified.', jobId: contact.jobRequest.id });
      },
      onError: (error) => {
        Alert.alert('Could not mark completed', error instanceof Error ? error.message : 'Please try again.');
      },
    });
  };

  const confirmCompletion = () => {
    confirmMutation.mutate(contact.id, {
      onSuccess: async () => {
        await completionQuery.refetch({ cancelRefetch: false });
        await query.refetch({ cancelRefetch: false });
        setCompletionInfo({ title: 'Completion Confirmed', body: 'Review is now available.', jobId: contact.jobRequest.id });
      },
      onError: (error) => {
        Alert.alert('Could not confirm completion', error instanceof Error ? error.message : 'Please try again.');
      },
    });
  };

  const openConversation = () => {
    ensureConversationMutation.mutate(contact.id, {
      onSuccess: (conversation) => {
        navigation
          .getParent()
          ?.navigate('MessagesTab', { screen: 'ConversationThread', params: { conversationId: conversation.id } });
      },
      onError: (error) => {
        Alert.alert('Could not open chat', error instanceof Error ? error.message : 'Please try again.');
      },
    });
  };

  return (
    <Screen
      refreshing={query.isRefetching || completionQuery.isRefetching}
      onRefresh={() => {
        if (!query.isFetching) void query.refetch({ cancelRefetch: false });
        if (!completionQuery.isFetching) void completionQuery.refetch({ cancelRefetch: false });
      }}
    >
      <AppModal
        visible={Boolean(completionInfo)}
        title={completionInfo?.title ?? ''}
        body={completionInfo?.body ?? ''}
        icon={CheckCircle2}
        actions={[
          { label: 'Close', onPress: () => setCompletionInfo(null) },
          ...(isEmployer && completionInfo?.jobId
            ? [
                {
                  label: 'Back to Job Details',
                  variant: 'primary' as const,
                  onPress: () => {
                    const jobId = completionInfo.jobId as string;
                    setCompletionInfo(null);
                    navigation.getParent()?.navigate('JobsTab', { screen: 'JobDetails', params: { jobId } });
                  },
                },
                {
                  label: 'Back to Jobs',
                  onPress: () => {
                    setCompletionInfo(null);
                    navigation.getParent()?.navigate('JobsTab', { screen: 'EmployerJobs' });
                  },
                },
              ]
            : [
                {
                  label: 'Back',
                  variant: 'primary' as const,
                  onPress: () => {
                    setCompletionInfo(null);
                    navigation.goBack();
                  },
                },
              ]),
        ]}
        onRequestClose={() => setCompletionInfo(null)}
      />
      <Card>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{contact.jobRequest.title}</Text>
          <Badge status={contact.status} />
        </View>
        <Text style={[styles.copy, { color: theme.colors.textMuted }]}>{contact.jobRequest.location}</Text>
        <Text style={[styles.price, { color: theme.colors.text }]}>
          EUR {contact.offer.estimatedPrice} / {contact.offer.estimatedCompletionDays} days
        </Text>
      </Card>
      <PersonCard title="Employer" user={contact.employer} />
      <PersonCard title="Contractor" user={contact.contractor} />
      {!isAdminView ? (
        <Button
          title="Contractor Profile"
          icon={Star}
          variant="secondary"
          onPress={() => navigation.navigate('ContractorProfile', { contractorId: contact.contractorId })}
        />
      ) : null}
      {!isAdminView ? (
        <Button
          title="Open Conversation"
          icon={MessageCircle}
          loading={ensureConversationMutation.isPending}
          onPress={openConversation}
        />
      ) : null}
      <Card>
        <View style={styles.headerRow}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Completion</Text>
          <Badge status={completionStatus} />
        </View>
        <Text style={[styles.copy, { color: theme.colors.textMuted }]}>
          {completionStatus === 'NOT_STARTED'
            ? 'The contractor has not marked this job completed yet.'
            : completionStatus === 'PENDING_EMPLOYER_CONFIRMATION'
              ? 'Waiting for employer confirmation.'
              : completionStatus === 'CONFIRMED'
                ? 'Completion confirmed. Review can be submitted once.'
                : completionStatus}
        </Text>
        {isContractor && completionStatus === 'NOT_STARTED' ? (
          <Button
            title="Mark Job Completed"
            icon={ClipboardCheck}
            loading={completeMutation.isPending}
            onPress={markComplete}
          />
        ) : null}
        {isEmployer && completionStatus === 'PENDING_EMPLOYER_CONFIRMATION' ? (
          <Button
            title="Confirm Completion"
            icon={CheckCircle2}
            loading={confirmMutation.isPending}
            onPress={confirmCompletion}
          />
        ) : null}
        {isEmployer && completion?.canReview && !completion.review ? (
          <Button title="Leave Review" icon={Star} onPress={() => navigation.navigate('LeaveReview', { contactId: contact.id })} />
        ) : null}
        {completion?.review ? (
          <Button
            title={completion.review.status === 'REMOVED' ? 'Review Removed' : 'View Review'}
            icon={Star}
            variant="secondary"
            onPress={() => navigation.navigate('ReviewDetails', { reviewId: completion.review?.id ?? '' })}
          />
        ) : null}
      </Card>
      {contact.tokenTransaction ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Unlock transaction</Text>
          <Text style={[styles.copy, { color: theme.colors.textMuted }]}>
            {contact.tokenTransaction.description} / {contact.tokenTransaction.amount} token
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}

function PersonCard({ title, user }: { title: string; user: AuthUser }) {
  const theme = useTheme();
  const displayName = user.profile?.displayName ?? user.email;

  return (
    <Card>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
      <View style={styles.iconRow}>
        <UserRound color={theme.colors.textMuted} size={17} />
        <Text style={[styles.copy, { color: theme.colors.textMuted }]}>{displayName}</Text>
      </View>
      <View style={styles.iconRow}>
        <Mail color={theme.colors.textMuted} size={17} />
        <Text style={[styles.copy, { color: theme.colors.textMuted }]}>{user.email}</Text>
      </View>
      {user.profile?.phone ? (
        <View style={styles.iconRow}>
          <Phone color={theme.colors.textMuted} size={17} />
          <Text style={[styles.copy, { color: theme.colors.textMuted }]}>{user.profile.phone}</Text>
        </View>
      ) : null}
      {user.profile?.companyName ? (
        <Text style={[styles.copy, { color: theme.colors.textMuted }]}>{user.profile.companyName}</Text>
      ) : null}
      {user.profile?.bio ? (
        <Text style={[styles.copy, { color: theme.colors.textMuted }]}>{user.profile.bio}</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '900',
  },
  price: {
    fontSize: 18,
    fontWeight: '900',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  copy: {
    fontSize: 14,
    lineHeight: 20,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
