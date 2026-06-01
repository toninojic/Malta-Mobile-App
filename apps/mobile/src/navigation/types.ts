import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
};

export type JobsStackParamList = {
  EmployerJobs: undefined;
  JobDetails: { jobId: string };
  JobForm: { jobId?: string };
  OfferForm: { jobId: string; offerId?: string };
  UnlockContact: { offerId: string };
  MyOffers: undefined;
};

export type WalletStackParamList = {
  WalletHome: undefined;
  RefundRequest: { transactionId: string };
  AdminRefundDetails: { refundId: string };
};

export type ActivityStackParamList = {
  ActivityHome: undefined;
  Contacts: undefined;
  ContactDetails: { contactId: string; admin?: boolean };
  LeaveReview: { contactId: string };
  ReviewDetails: { reviewId: string; admin?: boolean };
  MyReviews: undefined;
  ContractorProfile: { contractorId: string };
  AdminReviews: undefined;
  NotificationsHome: undefined;
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
  WalletTab: NavigatorScreenParams<WalletStackParamList>;
  MessagesTab: NavigatorScreenParams<MessagesStackParamList>;
  AlertsTab: undefined;
  ProfileTab: undefined;
};
