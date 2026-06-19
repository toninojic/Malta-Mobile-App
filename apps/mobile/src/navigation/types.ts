import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
};

export type JobsStackParamList = {
  EmployerJobs: undefined;
  JobDetails: { jobId: string };
  JobForm: {
    jobId?: string;
    draft?: {
      title: string;
      description: string;
      category: string;
      subcategory: string;
      location: string;
    };
  } | undefined;
  OfferForm: { jobId: string; offerId?: string };
  OfferWorkDetails: { offerId: string };
  UnlockContact: { offerId: string };
  MyOffers: { mode?: 'activity' | 'active'; initialFilter?: string } | undefined;
};

export type WalletStackParamList = {
  WalletHome: undefined;
  RefundRequest: { transactionId: string };
  AdminRefundDetails: { refundId: string };
  PaymentSuccess: { paymentId?: string } | undefined;
  PaymentFailed: { paymentId?: string } | undefined;
  PaymentPending: { paymentId?: string } | undefined;
};

export type ActivityStackParamList = {
  ActivityHome: undefined;
  Contacts:
    | {
        filter?: 'all' | 'in_progress' | 'completed';
        emptyTitle?: string;
        emptyMessage?: string;
      }
    | undefined;
  ContactDetails: { contactId: string; admin?: boolean };
  LeaveReview: { contactId: string; target?: 'contractor' | 'employer' };
  ReviewDetails: { reviewId: string; admin?: boolean; target?: 'contractor' | 'employer' };
  MyReviews: { initialTab?: 'received' | 'given' | 'toLeave' } | undefined;
  ContractorProfile: { contractorId: string };
  AdminReviews: undefined;
  NotificationsHome: undefined;
  WalletHome: undefined;
  RefundRequest: { transactionId: string };
  AdminRefundDetails: { refundId: string };
  PaymentSuccess: { paymentId?: string } | undefined;
  PaymentFailed: { paymentId?: string } | undefined;
  PaymentPending: { paymentId?: string } | undefined;
};

export type MessagesStackParamList = {
  Conversations: undefined;
  ConversationThread: { conversationId: string };
};

export type AppTabParamList = {
  AdminDashboardTab: undefined;
  AdminUsersTab: undefined;
  AdminJobsTab: undefined;
  AdminModerationTab: undefined;
  JobsTab: NavigatorScreenParams<JobsStackParamList>;
  ActivityTab: NavigatorScreenParams<ActivityStackParamList>;
  MessagesTab: NavigatorScreenParams<MessagesStackParamList>;
  AlertsTab: undefined;
  ProfileTab: undefined;
};
