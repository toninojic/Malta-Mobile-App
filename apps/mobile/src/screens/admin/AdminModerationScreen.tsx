import { CheckCircle2, Eye, Link2, MessageCircle, RefreshCw, RotateCcw, ScrollText, Star, XCircle } from 'lucide-react-native';
import { ComponentType, ReactNode, useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { useAdminAuditLogs, useAdminConversationMessages, useAdminRefundsForModeration } from '../../api/adminHooks';
import { useAdminContacts } from '../../api/contactHooks';
import { useAdminConversations } from '../../api/messageHooks';
import {
  useAdminContractorVerifications,
  useApproveContractorVerification,
  useRejectContractorVerification,
} from '../../api/offerWorkHooks';
import { useAdminReviews, useRemoveReview } from '../../api/reviewHooks';
import { useApproveRefund, useRejectRefund } from '../../api/tokenHooks';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { ImageViewerModal } from '../../components/ImageViewerModal';
import { OptionSelect } from '../../components/OptionSelect';
import { ReviewCard } from '../../components/reviews/ReviewCard';
import { RefundCard } from '../../components/wallet/RefundCard';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../design/theme';
import { getAccessToken } from '../../store/auth.store';
import { ContractorVerification, Conversation, Review } from '../../types/domain';
import { formatDate } from '../../utils/date';

const SECTION_OPTIONS = [
  { key: 'REFUNDS', label: 'Refunds' },
  { key: 'REVIEWS', label: 'Reviews' },
  { key: 'CONVERSATIONS', label: 'Chats' },
  { key: 'CONTACTS', label: 'Contacts' },
  { key: 'VERIFICATIONS', label: 'Verifications' },
  { key: 'AUDIT', label: 'Audit' },
];

type Section = 'REFUNDS' | 'REVIEWS' | 'CONVERSATIONS' | 'CONTACTS' | 'VERIFICATIONS' | 'AUDIT';

export function AdminModerationScreen() {
  const theme = useTheme();
  const [section, setSection] = useState<Section>('REFUNDS');

  return (
    <Screen contentTopPadding={28}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Moderation</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Refunds, reviews, conversations, contact unlocks, and immutable audit logs.</Text>
      </View>

      <OptionSelect label="Queue" value={section} options={SECTION_OPTIONS} onChange={(value) => setSection(value as Section)} />

      {section === 'REFUNDS' ? <RefundsSection /> : null}
      {section === 'REVIEWS' ? <ReviewsSection /> : null}
      {section === 'CONVERSATIONS' ? <ConversationsSection /> : null}
      {section === 'CONTACTS' ? <ContactsSection /> : null}
      {section === 'VERIFICATIONS' ? <VerificationsSection /> : null}
      {section === 'AUDIT' ? <AuditSection /> : null}
    </Screen>
  );
}

function VerificationsSection() {
  const theme = useTheme();
  const query = useAdminContractorVerifications(true);
  const approveMutation = useApproveContractorVerification();
  const rejectMutation = useRejectContractorVerification();
  const [previewDocument, setPreviewDocument] = useState<ContractorVerification | null>(null);
  const authHeaders = accessTokenHeaders();

  const approve = (verificationId: string) => {
    Alert.alert('Approve verification', 'Approve this contractor verification?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: () => approveMutation.mutate(verificationId) },
    ]);
  };

  const reject = (verificationId: string) => {
    Alert.alert('Reject verification', 'Reject this verification request?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => rejectMutation.mutate({ id: verificationId }) },
    ]);
  };

  const openDocument = async (verification: ContractorVerification) => {
    if (!verification.documentUrl) {
      return;
    }

    if (isImageDocument(verification)) {
      setPreviewDocument(verification);
      return;
    }

    const url = documentUrlWithToken(verification.documentUrl);
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Could not open document', 'No app is available to open this document.');
      return;
    }

    await Linking.openURL(url);
  };

  return (
    <SectionFrame
      loading={query.isLoading}
      error={query.error}
      empty={!query.isLoading && query.data?.data.length === 0}
      emptyIcon={CheckCircle2}
      emptyTitle="No verification requests"
      onRetry={() => void query.refetch()}
    >
      <ImageViewerModal
        images={
          previewDocument?.documentUrl
            ? [
                {
                  id: previewDocument.id ?? previewDocument.documentUrl,
                  url: previewDocument.documentUrl,
                  headers: authHeaders,
                },
              ]
            : []
        }
        initialIndex={0}
        visible={Boolean(previewDocument)}
        onClose={() => setPreviewDocument(null)}
      />
      {query.data?.data.map((verification) => (
        <Card key={verification.id}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                {verification.contractor?.profile?.displayName ?? verification.contractor?.email ?? 'Contractor'}
              </Text>
              <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
                {verification.documentMimeType ?? 'Document'} / {formatDate(verification.createdAt)}
              </Text>
            </View>
            <Badge status={verification.status} />
          </View>
          {verification.documentUrl ? (
            <View style={styles.documentRow}>
              <Text style={[styles.metadata, styles.documentPath, { color: theme.colors.textMuted }]} numberOfLines={2}>
                {verification.documentUrl}
              </Text>
              <Button
                title={isImageDocument(verification) ? 'Preview' : 'Open'}
                icon={Eye}
                variant="secondary"
                onPress={() => void openDocument(verification)}
                style={styles.documentButton}
              />
            </View>
          ) : null}
          {verification.status === 'PENDING_REVIEW' && verification.id ? (
            <View style={styles.actions}>
              <Button title="Approve" icon={CheckCircle2} loading={approveMutation.isPending} onPress={() => approve(verification.id as string)} style={styles.action} />
              <Button title="Reject" icon={XCircle} variant="danger" loading={rejectMutation.isPending} onPress={() => reject(verification.id as string)} style={styles.action} />
            </View>
          ) : null}
        </Card>
      ))}
    </SectionFrame>
  );
}

function RefundsSection() {
  const approveMutation = useApproveRefund();
  const rejectMutation = useRejectRefund();
  const query = useAdminRefundsForModeration(true);

  const approve = (refundId: string) => {
    Alert.alert('Approve refund', 'Approve this refund and subtract tokens from the wallet?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: () => approveMutation.mutate({ refundRequestId: refundId }) },
    ]);
  };

  const reject = (refundId: string) => {
    Alert.alert('Reject refund', 'Reject this refund request?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => rejectMutation.mutate({ refundRequestId: refundId }) },
    ]);
  };

  return (
    <SectionFrame
      loading={query.isLoading}
      error={query.error}
      empty={!query.isLoading && query.data?.data.length === 0}
      emptyIcon={RotateCcw}
      emptyTitle="No refunds"
      onRetry={() => void query.refetch()}
    >
      {query.data?.data.map((refund) => (
        <View key={refund.id} style={styles.itemGroup}>
          <RefundCard refund={refund} />
          {refund.status === 'PENDING' ? (
            <View style={styles.actions}>
              <Button title="Approve" icon={CheckCircle2} loading={approveMutation.isPending} onPress={() => approve(refund.id)} style={styles.action} />
              <Button title="Reject" icon={XCircle} variant="danger" loading={rejectMutation.isPending} onPress={() => reject(refund.id)} style={styles.action} />
            </View>
          ) : null}
        </View>
      ))}
    </SectionFrame>
  );
}

function ReviewsSection() {
  const query = useAdminReviews(true);
  const removeMutation = useRemoveReview();

  const remove = (review: Review) => {
    Alert.alert('Remove review', `Remove review for "${review.jobRequest?.title ?? 'this job'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeMutation.mutate(review.id) },
    ]);
  };

  return (
    <SectionFrame
      loading={query.isLoading}
      error={query.error}
      empty={!query.isLoading && query.data?.data.length === 0}
      emptyIcon={Star}
      emptyTitle="No reviews"
      onRetry={() => void query.refetch()}
    >
      {query.data?.data.map((review) => (
        <View key={review.id} style={styles.itemGroup}>
          <ReviewCard review={review} />
          <Button
            title="Remove Review"
            icon={XCircle}
            variant="danger"
            disabled={review.status === 'REMOVED'}
            loading={removeMutation.isPending}
            onPress={() => remove(review)}
          />
        </View>
      ))}
    </SectionFrame>
  );
}

function ConversationsSection() {
  const theme = useTheme();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const query = useAdminConversations(true);
  const messagesQuery = useAdminConversationMessages(selectedConversation?.id);

  return (
    <SectionFrame
      loading={query.isLoading}
      error={query.error}
      empty={!query.isLoading && query.data?.data.length === 0}
      emptyIcon={MessageCircle}
      emptyTitle="No conversations"
      onRetry={() => void query.refetch()}
    >
      {query.data?.data.map((conversation) => (
        <Card key={conversation.id} onPress={() => setSelectedConversation(conversation)}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                {conversation.contactUnlock.jobRequest.title}
              </Text>
              <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
                {conversation.employer.email} / {conversation.contractor.email}
              </Text>
            </View>
            <Badge status={`${conversation.unreadCount} unread`} />
          </View>
          <Text style={[styles.meta, { color: theme.colors.textMuted }]} numberOfLines={2}>
            {conversation.lastMessage?.content ?? 'No messages yet.'}
          </Text>
        </Card>
      ))}

      {selectedConversation ? (
        <Card>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Messages: {selectedConversation.contactUnlock.jobRequest.title}</Text>
          {messagesQuery.isLoading ? <ActivityIndicator color={theme.colors.primary} /> : null}
          {messagesQuery.data?.length === 0 ? (
            <Text style={[styles.meta, { color: theme.colors.textMuted }]}>No messages in this conversation.</Text>
          ) : null}
          {messagesQuery.data?.map((message) => (
            <View key={message.id} style={[styles.message, { borderColor: theme.colors.border }]}>
              <Text style={[styles.meta, { color: theme.colors.textMuted }]}>{message.sender?.email ?? message.senderId}</Text>
              <Text style={[styles.messageBody, { color: theme.colors.text }]}>{message.content}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </SectionFrame>
  );
}

function ContactsSection() {
  const theme = useTheme();
  const query = useAdminContacts(true);

  return (
    <SectionFrame
      loading={query.isLoading}
      error={query.error}
      empty={!query.isLoading && query.data?.data.length === 0}
      emptyIcon={Link2}
      emptyTitle="No contact unlocks"
      onRetry={() => void query.refetch()}
    >
      {query.data?.data.map((contact) => (
        <Card key={contact.id}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{contact.jobRequest.title}</Text>
              <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
                Employer: {contact.employer.email}
              </Text>
              <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
                Contractor: {contact.contractor.email}
              </Text>
            </View>
            <Badge status={contact.status} />
          </View>
          <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
            Offer: EUR {contact.offer.estimatedPrice} / {contact.offer.estimatedCompletionDays} days
          </Text>
        </Card>
      ))}
    </SectionFrame>
  );
}

function AuditSection() {
  const theme = useTheme();
  const query = useAdminAuditLogs(true);

  return (
    <SectionFrame
      loading={query.isLoading}
      error={query.error}
      empty={!query.isLoading && query.data?.data.length === 0}
      emptyIcon={ScrollText}
      emptyTitle="No audit logs"
      onRetry={() => void query.refetch()}
    >
      {query.data?.data.map((auditLog) => (
        <Card key={auditLog.id}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{auditLog.action}</Text>
              <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
                {auditLog.entityType} / {auditLog.entityId}
              </Text>
            </View>
            <Badge status={formatDate(auditLog.createdAt)} />
          </View>
          <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
            Admin: {auditLog.admin?.email ?? auditLog.adminId}
          </Text>
          {auditLog.metadata ? (
            <Text style={[styles.metadata, { color: theme.colors.textMuted }]} numberOfLines={4}>
              {JSON.stringify(auditLog.metadata)}
            </Text>
          ) : null}
        </Card>
      ))}
    </SectionFrame>
  );
}

function isImageDocument(verification: ContractorVerification) {
  return verification.documentMimeType?.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(verification.documentUrl ?? '');
}

function documentUrlWithToken(url: string) {
  const accessToken = getAccessToken();
  if (!accessToken) {
    return url;
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}token=${encodeURIComponent(accessToken)}`;
}

function accessTokenHeaders() {
  const accessToken = getAccessToken();
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
}

function SectionFrame({
  loading,
  error,
  empty,
  emptyIcon,
  emptyTitle,
  onRetry,
  children,
}: {
  loading: boolean;
  error: unknown;
  empty: boolean;
  emptyIcon: ComponentType<{ color?: string; size?: number }>;
  emptyTitle: string;
  onRetry: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={styles.section}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : null}
      {error ? (
        <EmptyState
          icon={RefreshCw}
          title="Could not load queue"
          message={error instanceof Error ? error.message : 'Please try again.'}
          actionTitle="Retry"
          onAction={onRetry}
        />
      ) : null}
      {empty ? <EmptyState icon={emptyIcon} title={emptyTitle} message="Nothing needs attention right now." /> : null}
      {children}
    </View>
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
  section: {
    gap: 12,
  },
  itemGroup: {
    gap: 8,
  },
  center: {
    paddingVertical: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  action: {
    flex: 1,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  flex: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  meta: {
    fontSize: 13,
    lineHeight: 19,
  },
  message: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
    paddingTop: 8,
  },
  messageBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  metadata: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  documentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  documentPath: {
    flex: 1,
  },
  documentButton: {
    width: 104,
  },
});
