import { CheckCircle2, Eye, Flag, Link2, MessageCircle, RefreshCw, RotateCcw, ScrollText, Star, UserCheck, UserX, XCircle } from 'lucide-react-native';
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
import { useAdminReportAction, useAdminReports, useUpdateAdminReportStatus } from '../../api/reportHooks';
import { useAdminReviews, useRemoveReview } from '../../api/reviewHooks';
import { useApproveRefund, useRejectRefund } from '../../api/tokenHooks';
import { AppModal, AppModalAction } from '../../components/AppModal';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { ImageViewerModal } from '../../components/ImageViewerModal';
import { OptionSelect } from '../../components/OptionSelect';
import { ReviewCard } from '../../components/reviews/ReviewCard';
import { RefundCard } from '../../components/wallet/RefundCard';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useTheme } from '../../design/theme';
import { getAccessToken } from '../../store/auth.store';
import { ContractorVerification, Conversation, Report, ReportStatus, ReportTargetType, Review } from '../../types/domain';
import { formatDate } from '../../utils/date';
import {
  REPORT_REASON_OPTIONS,
  REPORT_STATUS_OPTIONS,
  REPORT_TARGET_OPTIONS,
  reportReasonLabel,
  reportTargetLabel,
} from '../../utils/reportLabels';

const SECTION_OPTIONS = [
  { key: 'REPORTS', label: 'Reports' },
  { key: 'REFUNDS', label: 'Refunds' },
  { key: 'REVIEWS', label: 'Reviews' },
  { key: 'CONVERSATIONS', label: 'Chats' },
  { key: 'CONTACTS', label: 'Contacts' },
  { key: 'VERIFICATIONS', label: 'Verifications' },
  { key: 'AUDIT', label: 'Audit' },
];

type Section = 'REPORTS' | 'REFUNDS' | 'REVIEWS' | 'CONVERSATIONS' | 'CONTACTS' | 'VERIFICATIONS' | 'AUDIT';

type ModerationDialog = {
  title: string;
  body: string;
  icon: ComponentType<{ color?: string; size?: number }>;
  actions: AppModalAction[];
};

export function AdminModerationScreen() {
  const theme = useTheme();
  const [section, setSection] = useState<Section>('REPORTS');

  return (
    <Screen contentTopPadding={28}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Moderation</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Reports, refunds, reviews, conversations, contact unlocks, and immutable audit logs.</Text>
      </View>

      <OptionSelect label="Queue" value={section} options={SECTION_OPTIONS} onChange={(value) => setSection(value as Section)} />

      {section === 'REPORTS' ? <ReportsSection /> : null}
      {section === 'REFUNDS' ? <RefundsSection /> : null}
      {section === 'REVIEWS' ? <ReviewsSection /> : null}
      {section === 'CONVERSATIONS' ? <ConversationsSection /> : null}
      {section === 'CONTACTS' ? <ContactsSection /> : null}
      {section === 'VERIFICATIONS' ? <VerificationsSection /> : null}
      {section === 'AUDIT' ? <AuditSection /> : null}
    </Screen>
  );
}

const REPORT_STATUS_FILTER_OPTIONS = [{ key: 'ALL', label: 'All' }, ...REPORT_STATUS_OPTIONS];
const REPORT_TARGET_FILTER_OPTIONS = [{ key: 'ALL', label: 'All targets' }, ...REPORT_TARGET_OPTIONS];
const REPORT_REASON_FILTER_OPTIONS = [{ key: 'ALL', label: 'All reasons' }, ...REPORT_REASON_OPTIONS];

function ReportsSection() {
  const theme = useTheme();
  const [status, setStatus] = useState<'ALL' | ReportStatus>('PENDING');
  const [targetType, setTargetType] = useState<'ALL' | ReportTargetType>('ALL');
  const [reason, setReason] = useState<'ALL' | Report['reason']>('ALL');
  const [adminNote, setAdminNote] = useState('');
  const [confirmationDialog, setConfirmationDialog] = useState<ModerationDialog | null>(null);
  const query = useAdminReports(
    {
      status: status === 'ALL' ? undefined : status,
      targetType: targetType === 'ALL' ? undefined : targetType,
      reason: reason === 'ALL' ? undefined : reason,
    },
    true,
  );
  const updateStatusMutation = useUpdateAdminReportStatus();
  const actionMutation = useAdminReportAction();

  const updateStatus = (reportId: string, nextStatus: ReportStatus) => {
    updateStatusMutation.mutate(
      {
        reportId,
        status: nextStatus,
        adminNote: adminNote.trim() || undefined,
      },
      {
        onSuccess: () => setAdminNote(''),
      },
    );
  };

  const confirmAction = (
    report: Report,
    action: 'suspend-user' | 'activate-user' | 'close-job' | 'remove-review' | 'hide-message',
    title: string,
    body: string,
    destructive = true,
  ) => {
    setConfirmationDialog({
      title,
      body,
      icon: destructive ? XCircle : CheckCircle2,
      actions: [
        { label: 'Cancel', variant: 'secondary', onPress: () => setConfirmationDialog(null) },
        {
          label: title,
          variant: destructive ? 'danger' : 'primary',
          onPress: () => {
            setConfirmationDialog(null);
            actionMutation.mutate({ reportId: report.id, action });
          },
        },
      ],
    });
  };

  return (
    <SectionFrame
      loading={query.isLoading}
      error={query.error}
      empty={!query.isLoading && query.data?.data.length === 0}
      emptyIcon={Flag}
      emptyTitle="No reports"
      onRetry={() => void query.refetch()}
    >
      {confirmationDialog ? (
        <AppModal
          visible
          title={confirmationDialog.title}
          body={confirmationDialog.body}
          icon={confirmationDialog.icon}
          actions={confirmationDialog.actions}
          onRequestClose={() => setConfirmationDialog(null)}
        />
      ) : null}
      <View style={styles.filterGrid}>
        <OptionSelect label="Status" value={status} options={REPORT_STATUS_FILTER_OPTIONS} onChange={(value) => setStatus(value as 'ALL' | ReportStatus)} />
        <OptionSelect label="Target" value={targetType} options={REPORT_TARGET_FILTER_OPTIONS} onChange={(value) => setTargetType(value as 'ALL' | ReportTargetType)} />
        <OptionSelect label="Reason" value={reason} options={REPORT_REASON_FILTER_OPTIONS} onChange={(value) => setReason(value as 'ALL' | Report['reason'])} />
      </View>
      <TextField
        label="Admin note for status changes"
        value={adminNote}
        onChangeText={setAdminNote}
        multiline
        maxLength={1500}
        placeholder="Optional note saved with the next status update."
      />
      {query.data?.data.map((report) => (
        <Card key={report.id}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                {report.targetSummary?.title ?? reportTargetLabel(report.targetType)}
              </Text>
              <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
                {reportTargetLabel(report.targetType)} / {reportReasonLabel(report.reason)} / {formatDate(report.createdAt)}
              </Text>
              <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
                Reporter: {report.reporter?.email ?? report.reporterId ?? 'Unknown'}
              </Text>
            </View>
            <Badge status={report.status} />
          </View>
          {report.targetSummary?.subtitle ? (
            <Text style={[styles.meta, { color: theme.colors.textMuted }]}>{report.targetSummary.subtitle}</Text>
          ) : null}
          {report.description ? (
            <Text style={[styles.messageBody, { color: theme.colors.text }]}>{report.description}</Text>
          ) : null}
          {report.adminNote ? (
            <View style={[styles.note, { borderColor: theme.colors.border }]}>
              <Text style={[styles.metaStrong, { color: theme.colors.text }]}>Admin note</Text>
              <Text style={[styles.meta, { color: theme.colors.textMuted }]}>{report.adminNote}</Text>
            </View>
          ) : null}
          {report.targetSummary?.metadata ? (
            <Text style={[styles.metadata, { color: theme.colors.textMuted }]} numberOfLines={4}>
              {JSON.stringify(report.targetSummary.metadata)}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Button
              title="Under Review"
              icon={Eye}
              variant="secondary"
              loading={updateStatusMutation.isPending}
              onPress={() => updateStatus(report.id, 'UNDER_REVIEW')}
              style={styles.action}
            />
            <Button
              title="Resolve"
              icon={CheckCircle2}
              loading={updateStatusMutation.isPending}
              onPress={() => updateStatus(report.id, 'RESOLVED')}
              style={styles.action}
            />
            <Button
              title="Dismiss"
              icon={XCircle}
              variant="secondary"
              loading={updateStatusMutation.isPending}
              onPress={() => updateStatus(report.id, 'DISMISSED')}
              style={styles.action}
            />
          </View>
          <ReportModerationActions
            report={report}
            loading={actionMutation.isPending}
            onAction={confirmAction}
          />
        </Card>
      ))}
    </SectionFrame>
  );
}

function ReportModerationActions({
  report,
  loading,
  onAction,
}: {
  report: Report;
  loading: boolean;
  onAction: (
    report: Report,
    action: 'suspend-user' | 'activate-user' | 'close-job' | 'remove-review' | 'hide-message',
    title: string,
    body: string,
    destructive?: boolean,
  ) => void;
}) {
  if (report.targetType === 'USER') {
    return (
      <View style={styles.actions}>
        <Button
          title="Suspend User"
          icon={UserX}
          variant="danger"
          loading={loading}
          onPress={() => onAction(report, 'suspend-user', 'Suspend User', 'Suspend this reported user account?')}
          style={styles.action}
        />
        <Button
          title="Activate User"
          icon={UserCheck}
          variant="secondary"
          loading={loading}
          onPress={() => onAction(report, 'activate-user', 'Activate User', 'Activate this reported user account?', false)}
          style={styles.action}
        />
      </View>
    );
  }

  if (report.targetType === 'JOB') {
    return (
      <Button
        title="Close Job"
        icon={XCircle}
        variant="danger"
        loading={loading}
        onPress={() => onAction(report, 'close-job', 'Close Job', 'Close this reported job request?')}
      />
    );
  }

  if (report.targetType === 'REVIEW') {
    return (
      <Button
        title="Remove Review"
        icon={XCircle}
        variant="danger"
        loading={loading}
        onPress={() => onAction(report, 'remove-review', 'Remove Review', 'Soft-remove this reported review?')}
      />
    );
  }

  if (report.targetType === 'MESSAGE') {
    return (
      <Button
        title="Hide Message"
        icon={XCircle}
        variant="danger"
        loading={loading}
        onPress={() => onAction(report, 'hide-message', 'Hide Message', 'Soft-hide this reported message?')}
      />
    );
  }

  return null;
}

function VerificationsSection() {
  const theme = useTheme();
  const query = useAdminContractorVerifications(true);
  const approveMutation = useApproveContractorVerification();
  const rejectMutation = useRejectContractorVerification();
  const [previewDocument, setPreviewDocument] = useState<ContractorVerification | null>(null);
  const [confirmationDialog, setConfirmationDialog] = useState<ModerationDialog | null>(null);
  const authHeaders = accessTokenHeaders();

  const approve = (verificationId: string) => {
    setConfirmationDialog({
      title: 'Approve Verification',
      body: 'Approve this contractor verification? The contractor will receive verified status and a notification.',
      icon: CheckCircle2,
      actions: [
        { label: 'Cancel', variant: 'secondary', onPress: () => setConfirmationDialog(null) },
        {
          label: 'Approve',
          variant: 'primary',
          onPress: () => {
            setConfirmationDialog(null);
            approveMutation.mutate(verificationId);
          },
        },
      ],
    });
  };

  const reject = (verificationId: string) => {
    setConfirmationDialog({
      title: 'Reject Verification',
      body: 'Reject this verification request? The contractor will be notified and can submit another document if eligible.',
      icon: XCircle,
      actions: [
        { label: 'Cancel', variant: 'secondary', onPress: () => setConfirmationDialog(null) },
        {
          label: 'Reject',
          variant: 'danger',
          onPress: () => {
            setConfirmationDialog(null);
            rejectMutation.mutate({ id: verificationId });
          },
        },
      ],
    });
  };

  const openDocument = async (verification: ContractorVerification) => {
    if (!verification.documentUrl) {
      return;
    }

    if (isImageDocument(verification)) {
      setPreviewDocument(verification);
      return;
    }

    const url = signedStorageUrl(verification.documentUrl) ? verification.documentUrl : documentUrlWithToken(verification.documentUrl);
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
      {confirmationDialog ? (
        <AppModal
          visible
          title={confirmationDialog.title}
          body={confirmationDialog.body}
          icon={confirmationDialog.icon}
          actions={confirmationDialog.actions}
          onRequestClose={() => setConfirmationDialog(null)}
        />
      ) : null}
      <ImageViewerModal
        images={
          previewDocument?.documentUrl
            ? [
                {
                  id: previewDocument.id ?? previewDocument.documentUrl,
                  url: previewDocument.documentUrl,
                  headers: signedStorageUrl(previewDocument.documentUrl) ? undefined : authHeaders,
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
  const [confirmationDialog, setConfirmationDialog] = useState<ModerationDialog | null>(null);

  const approve = (refundId: string) => {
    setConfirmationDialog({
      title: 'Approve Refund',
      body: 'Approve this refund and subtract tokens from the user wallet? The refund transaction will be recorded.',
      icon: RotateCcw,
      actions: [
        { label: 'Cancel', variant: 'secondary', onPress: () => setConfirmationDialog(null) },
        {
          label: 'Approve',
          variant: 'primary',
          onPress: () => {
            setConfirmationDialog(null);
            approveMutation.mutate({ refundRequestId: refundId });
          },
        },
      ],
    });
  };

  const reject = (refundId: string) => {
    setConfirmationDialog({
      title: 'Reject Refund',
      body: 'Reject this refund request? Token balance will not change.',
      icon: XCircle,
      actions: [
        { label: 'Cancel', variant: 'secondary', onPress: () => setConfirmationDialog(null) },
        {
          label: 'Reject',
          variant: 'danger',
          onPress: () => {
            setConfirmationDialog(null);
            rejectMutation.mutate({ refundRequestId: refundId });
          },
        },
      ],
    });
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
      {confirmationDialog ? (
        <AppModal
          visible
          title={confirmationDialog.title}
          body={confirmationDialog.body}
          icon={confirmationDialog.icon}
          actions={confirmationDialog.actions}
          onRequestClose={() => setConfirmationDialog(null)}
        />
      ) : null}
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
  const [confirmationDialog, setConfirmationDialog] = useState<ModerationDialog | null>(null);

  const remove = (review: Review) => {
    setConfirmationDialog({
      title: 'Remove Review',
      body: `Remove review for "${review.jobRequest?.title ?? 'this job'}"? It stays in the database but no longer counts toward ratings.`,
      icon: XCircle,
      actions: [
        { label: 'Cancel', variant: 'secondary', onPress: () => setConfirmationDialog(null) },
        {
          label: 'Remove',
          variant: 'danger',
          onPress: () => {
            setConfirmationDialog(null);
            removeMutation.mutate(review.id);
          },
        },
      ],
    });
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
      {confirmationDialog ? (
        <AppModal
          visible
          title={confirmationDialog.title}
          body={confirmationDialog.body}
          icon={confirmationDialog.icon}
          actions={confirmationDialog.actions}
          onRequestClose={() => setConfirmationDialog(null)}
        />
      ) : null}
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

function signedStorageUrl(url: string) {
  return url.includes('X-Amz-Signature=');
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
  filterGrid: {
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
  metaStrong: {
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 19,
  },
  note: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
    paddingTop: 8,
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
