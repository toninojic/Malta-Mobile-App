import { ReportReason, ReportStatus, ReportTargetType } from '../types/domain';

export const REPORT_REASON_OPTIONS: Array<{ key: ReportReason; label: string }> = [
  { key: 'SPAM', label: 'Spam' },
  { key: 'SCAM_OR_FRAUD', label: 'Scam or fraud' },
  { key: 'HARASSMENT', label: 'Harassment' },
  { key: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate content' },
  { key: 'FAKE_PROFILE', label: 'Fake profile' },
  { key: 'CONTACT_DETAILS_BYPASS', label: 'Trying to bypass contact unlock' },
  { key: 'PAYMENT_ISSUE', label: 'Payment issue' },
  { key: 'OTHER', label: 'Other' },
];

export const REPORT_STATUS_OPTIONS: Array<{ key: ReportStatus; label: string }> = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'UNDER_REVIEW', label: 'Under review' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'DISMISSED', label: 'Dismissed' },
];

export const REPORT_TARGET_OPTIONS: Array<{ key: ReportTargetType; label: string }> = [
  { key: 'USER', label: 'User' },
  { key: 'JOB', label: 'Job' },
  { key: 'OFFER', label: 'Offer' },
  { key: 'CONVERSATION', label: 'Conversation' },
  { key: 'MESSAGE', label: 'Message' },
  { key: 'REVIEW', label: 'Review' },
];

export function reportReasonLabel(reason: ReportReason) {
  return REPORT_REASON_OPTIONS.find((option) => option.key === reason)?.label ?? reason;
}

export function reportStatusLabel(status: ReportStatus) {
  return REPORT_STATUS_OPTIONS.find((option) => option.key === status)?.label ?? status;
}

export function reportTargetLabel(targetType: ReportTargetType) {
  return REPORT_TARGET_OPTIONS.find((option) => option.key === targetType)?.label ?? targetType;
}
