export type UserRole = 'EMPLOYER' | 'CONTRACTOR' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';
export type JobStatus = 'ACTIVE' | 'IN_PROGRESS' | 'EXPIRED' | 'COMPLETED' | 'CLOSED';
export type OfferStatus = 'PENDING' | 'SELECTED' | 'REJECTED' | 'WITHDRAWN' | 'COMPLETED';
export type OfferRejectionReason =
  | 'AUTO_REJECTED_BY_SELECTION'
  | 'MANUALLY_REJECTED_BY_EMPLOYER'
  | 'SELECTION_CANCELLED_BY_EMPLOYER';
export type TokenTransactionType =
  | 'PURCHASE'
  | 'SPEND'
  | 'REFUND'
  | 'ADMIN_GRANT'
  | 'ADMIN_REVOKE'
  | 'WELCOME_BONUS'
  | 'REFERRAL_BONUS';
export type RefundStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'IGNORED';
export type PaymentProvider = 'MOCK' | 'REVENUECAT' | 'LEGACY_STRIPE';
export type StorePlatform = 'IOS' | 'ANDROID' | 'REVENUECAT';
export type UnlockStatus = 'LOCKED' | 'PENDING' | 'UNLOCKED';
export type JobCompletionStatus = 'PENDING_EMPLOYER_CONFIRMATION' | 'CONFIRMED' | 'DISPUTED' | 'CANCELLED';
export type ReviewStatus = 'ACTIVE' | 'REMOVED';
export type ContractorVerificationStatus = 'UNVERIFIED' | 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED';
export type ReportTargetType = 'USER' | 'JOB' | 'OFFER' | 'CONVERSATION' | 'MESSAGE' | 'REVIEW';
export type ReportReason =
  | 'SPAM'
  | 'SCAM_OR_FRAUD'
  | 'HARASSMENT'
  | 'INAPPROPRIATE_CONTENT'
  | 'FAKE_PROFILE'
  | 'CONTACT_DETAILS_BYPASS'
  | 'PAYMENT_ISSUE'
  | 'OTHER';
export type ReportStatus = 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';
export type WorkDetailsAction =
  | 'EDIT_OFFER'
  | 'WITHDRAW_OFFER'
  | 'UNLOCK_CONTACT'
  | 'OPEN_CHAT'
  | 'MARK_COMPLETED'
  | 'VIEW_REVIEW'
  | 'VIEW_DETAILS';
export type NotificationType =
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_ACTIVATED'
  | 'NEW_OFFER'
  | 'OFFER_SELECTED'
  | 'NEW_MESSAGE'
  | 'NEW_JOB_NEARBY'
  | 'CONTACT_UNLOCKED'
  | 'REFUND_APPROVED'
  | 'REFUND_DENIED'
  | 'REFUND_REJECTED'
  | 'JOB_COMPLETED'
  | 'REVIEW_RECEIVED'
  | 'REVIEW_REPLIED'
  | 'REVIEW_REMOVED'
  | 'CONTRACTOR_VERIFICATION_APPROVED'
  | 'CONTRACTOR_VERIFICATION_REJECTED'
  | 'SYSTEM_ALERT'
  | 'NEW_REPORT'
  | 'REPORT_STATUS_UPDATED'
  | 'NEW_VERIFICATION_REQUEST'
  | 'NEW_REFUND_REQUEST';

export type UserProfile = {
  id: string;
  userId: string;
  displayName: string;
  phone?: string | null;
  location?: string | null;
  bio?: string | null;
  avatarKey?: string | null;
  avatarUrl?: string | null;
  companyName?: string | null;
  tradeCategories: string[];
};

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  profile?: UserProfile | null;
};

export type AdminUser = AuthUser & {
  tokenBalance?: TokenBalance | null;
  counts?: {
    jobRequests: number;
    offers: number;
    notifications: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type JobImage = {
  id: string;
  jobRequestId: string;
  key?: string;
  url: string;
  sortOrder: number;
  createdAt: string;
};

export type JobRequest = {
  id: string;
  employerId?: string;
  title: string;
  description: string;
  category: string;
  subcategory: string;
  location: string;
  status: JobStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  images: JobImage[];
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: PaginationMeta;
};

export type Offer = {
  id: string;
  jobRequestId: string;
  contractorId?: string;
  estimatedPrice: string;
  startDate: string;
  estimatedCompletionDays: number;
  message?: string | null;
  status: OfferStatus;
  selectedByEmployer: boolean;
  rejectionReason?: OfferRejectionReason | null;
  unlockStatus?: UnlockStatus;
  contactId?: string | null;
  completionStatus?: JobCompletionStatus | null;
  deletedAt?: string | null;
  rating?: number | null;
  totalReviews?: number;
  portfolioImages?: ContractorPortfolioImage[];
  verificationStatus?: ContractorVerificationStatus;
  createdAt: string;
  updatedAt: string;
  jobRequest?: JobRequest;
  employer?: AuthUser;
  contractor?: AuthUser;
  employerRatingSummary?: EmployerRatingSummary;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type JobFormValues = {
  title: string;
  description: string;
  category: string;
  subcategory: string;
  location: string;
  imageUrls: string[];
  imageKeys?: string[];
};

export type AiMessageRole = 'USER' | 'ASSISTANT';
export type AiConversationStatus = 'ACTIVE' | 'COMPLETED' | 'DISCARDED';
export type AiJobDraftStatus = 'DRAFT' | 'PUBLISHED' | 'DISCARDED';

export type AiConversation = {
  id: string;
  employerId: string;
  status: AiConversationStatus;
  createdAt: string;
  updatedAt: string;
};

export type AiMessage = {
  id: string;
  conversationId: string;
  role: AiMessageRole;
  content: string;
  createdAt: string;
};

export type AiJobDraft = {
  id: string;
  conversationId: string;
  employerId: string;
  title: string;
  description: string;
  categoryKey: string;
  subcategoryKey: string;
  locationKey: string;
  status: AiJobDraftStatus;
  publishedJobId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiUsage = {
  limit: number;
  usedMessages: number;
  remainingMessages: number;
  dateUtc: string;
};

export type AiJobAssistantState = {
  isAvailable: boolean;
  unavailableReason?: string | null;
  conversation: AiConversation | null;
  messages: AiMessage[];
  draft: AiJobDraft | null;
  usage: AiUsage;
  remainingMessages: number;
};

export type AiMessageResponse = {
  assistantMessage: string;
  draft: AiJobDraft | null;
  usage: AiUsage;
  remainingMessages: number;
};

export type AiPublishResponse = {
  job: JobRequest;
  draft: AiJobDraft;
};

export type UploadedJobImage = {
  key: string;
  url: string;
  fileName: string;
  size: number;
  mimeType: string;
};

export type JobBrowseFilters = {
  category?: string;
  subcategory?: string;
  search?: string;
  location?: string;
  sortBy?: 'newest' | 'oldest';
  page?: number;
  limit?: number;
};

export type OfferFormValues = {
  estimatedPrice: number;
  startDate: string;
  estimatedCompletionDays: number;
  message?: string;
};

export type ContractorPortfolioImage = {
  id: string;
  contractorId: string;
  key?: string;
  url: string;
  sortOrder: number;
  createdAt: string;
};

export type ContractorVerification = {
  id?: string;
  contractorId?: string;
  documentKey?: string;
  documentUrl?: string;
  documentMimeType?: string;
  status: ContractorVerificationStatus;
  adminNote?: string | null;
  reviewedByAdminId?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  contractor?: AuthUser;
  reviewedByAdmin?: Pick<AuthUser, 'id' | 'email' | 'profile'> | null;
};

export type ContractorProfile = {
  id: string;
  email?: string;
  status?: UserStatus;
  profile?: Partial<UserProfile> | null;
  ratingSummary?: ContractorRatingSummary | null;
  portfolioImages: ContractorPortfolioImage[];
  verificationStatus: ContractorVerificationStatus;
  canSeePrivateDetails: boolean;
};

export type TokenPackage = {
  id: string;
  title: string;
  tokenCount: number;
  price: string;
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TokenBalance = {
  id: string;
  userId: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
};

export type TokenTransaction = {
  id: string;
  userId: string;
  packageId?: string | null;
  type: TokenTransactionType;
  amount: number;
  description: string;
  balanceAfter: number;
  relatedRefundRequestId?: string | null;
  package?: TokenPackage | null;
  createdAt: string;
};

export type AdminTokenAdjustmentResponse = {
  balance: TokenBalance;
  transaction: TokenTransaction;
};

export type WelcomeBonusResponse = {
  granted: boolean;
  reason?: string | null;
  balance: TokenBalance;
  transaction: TokenTransaction | null;
};

export type RefundRequest = {
  id: string;
  userId: string;
  tokenTransactionId: string;
  amount: number;
  reason: string;
  status: RefundStatus;
  adminNote?: string | null;
  reviewedByAdminId?: string | null;
  reviewedAt?: string | null;
  requestedBy?: AuthUser;
  tokenTransaction?: TokenTransaction;
  refundTransaction?: Partial<TokenTransaction> | null;
  reviewedBy?: Pick<AuthUser, 'id' | 'email' | 'profile'> | null;
  createdAt: string;
  updatedAt: string;
};

export type Payment = {
  id: string;
  userId: string;
  tokenPackageId: string;
  provider?: PaymentProvider;
  platform?: StorePlatform | null;
  platformProductId?: string | null;
  revenueCatEventId?: string | null;
  revenueCatTransactionId?: string | null;
  amount: string;
  currency: string;
  status: PaymentStatus;
  failureReason?: string | null;
  tokenPackage: TokenPackage;
  createdAt: string;
  updatedAt: string;
};

export type PaymentConfig = {
  mode: 'MOCK' | 'REVENUECAT' | 'UNCONFIGURED';
  allowMockPurchases?: boolean;
  mockPurchasesEnabled: boolean;
  revenueCatConfigured?: boolean;
  purchasesConfigured?: boolean;
  provider?: 'REVENUECAT';
};

export type UnlockStatusResponse = {
  offerId: string;
  contactId?: string | null;
  status: UnlockStatus;
  isUnlocked: boolean;
  requestedByEmployer: boolean;
  cost: number;
};

export type ContactUnlock = {
  id: string;
  jobRequestId: string;
  offerId: string;
  employerId: string;
  contractorId: string;
  unlockedByContractorId?: string | null;
  status: Exclude<UnlockStatus, 'LOCKED'>;
  createdAt: string;
  updatedAt: string;
  jobRequest: JobRequest;
  offer: Pick<
    Offer,
    | 'id'
    | 'estimatedPrice'
    | 'startDate'
    | 'estimatedCompletionDays'
    | 'message'
    | 'status'
    | 'selectedByEmployer'
    | 'createdAt'
    | 'updatedAt'
  >;
  employer: AuthUser;
  contractor: AuthUser;
  unlockedByContractor?: Pick<AuthUser, 'id' | 'email' | 'profile'> | null;
  tokenTransaction?: Partial<TokenTransaction> | null;
};

export type UnlockResult = {
  contact: ContactUnlock;
  balance: TokenBalance;
  transaction: TokenTransaction;
};

export type JobCompletion = {
  id: string;
  jobRequestId: string;
  offerId: string;
  contactUnlockId: string;
  employerId: string;
  contractorId: string;
  status: JobCompletionStatus;
  contractorMarkedAt?: string | null;
  employerConfirmedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  jobRequest?: JobRequest;
  offer?: Pick<
    Offer,
    | 'id'
    | 'estimatedPrice'
    | 'startDate'
    | 'estimatedCompletionDays'
    | 'message'
    | 'status'
    | 'selectedByEmployer'
    | 'createdAt'
    | 'updatedAt'
  >;
  employer?: AuthUser;
  contractor?: AuthUser;
};

export type Review = {
  id: string;
  jobRequestId: string;
  offerId: string;
  contactUnlockId?: string | null;
  employerId: string;
  contractorId: string;
  rating: number;
  comment?: string | null;
  contractorReply?: string | null;
  contractorReplyAt?: string | null;
  status: ReviewStatus;
  removedByAdminId?: string | null;
  removedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  jobRequest?: JobRequest;
  offer?: Pick<
    Offer,
    | 'id'
    | 'estimatedPrice'
    | 'startDate'
    | 'estimatedCompletionDays'
    | 'message'
    | 'status'
    | 'selectedByEmployer'
    | 'createdAt'
    | 'updatedAt'
  >;
  employer?: AuthUser;
  contractor?: AuthUser;
  removedByAdmin?: Pick<AuthUser, 'id' | 'email' | 'profile'> | null;
};

export type ContractorRatingSummary = {
  id?: string | null;
  contractorId: string;
  averageRating: string;
  totalReviews: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type EmployerRatingSummary = {
  id?: string | null;
  employerId: string;
  averageRating: string;
  totalReviews: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type EmployerReview = {
  id: string;
  jobRequestId: string;
  offerId: string;
  contactUnlockId?: string | null;
  employerId: string;
  contractorId: string;
  rating: number;
  comment?: string | null;
  status: ReviewStatus;
  removedByAdminId?: string | null;
  removedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  jobRequest?: JobRequest;
  offer?: Pick<
    Offer,
    | 'id'
    | 'estimatedPrice'
    | 'startDate'
    | 'estimatedCompletionDays'
    | 'message'
    | 'status'
    | 'selectedByEmployer'
    | 'createdAt'
    | 'updatedAt'
  >;
  employer?: AuthUser;
  contractor?: AuthUser;
};

export type CompletionStatusResponse = {
  contactId: string;
  jobRequestId: string;
  offerId: string;
  status?: JobCompletionStatus | null;
  canReview: boolean;
  canReviewEmployer?: boolean;
  completion?: JobCompletion | null;
  review?: Review | null;
  employerReview?: EmployerReview | null;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
  sender?: Pick<AuthUser, 'id' | 'email' | 'profile'>;
};

export type Conversation = {
  id: string;
  contactUnlockId: string;
  employerId: string;
  contractorId: string;
  lastMessageAt?: string | null;
  createdAt: string;
  updatedAt: string;
  contactUnlock: {
    id: string;
    jobRequestId: string;
    offerId: string;
    status: Exclude<UnlockStatus, 'LOCKED'>;
    jobRequest: JobRequest;
      offer: {
        id: string;
        estimatedPrice: string;
        startDate?: string;
        estimatedCompletionDays: number;
        message?: string | null;
    };
  };
  employer: Pick<AuthUser, 'id' | 'email' | 'profile'>;
  contractor: Pick<AuthUser, 'id' | 'email' | 'profile'>;
  lastMessage?: ChatMessage | null;
  messages?: ChatMessage[];
  unreadCount: number;
};

export type InAppNotification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown> | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
};

export type PushTokenPlatform = 'ios' | 'android' | 'web' | 'unknown';

export type PushToken = {
  id: string;
  userId: string;
  expoPushToken: string;
  platform: PushTokenPlatform;
  deviceId?: string | null;
  deviceName?: string | null;
  isActive: boolean;
  lastUsedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PushTokenDebugResponse = {
  userId: string;
  count: number;
  activeCount: number;
  tokens: PushToken[];
};

export type PushTestDebugResponse = {
  userId: string;
  sent: number;
  tokenCount: number;
  tokens?: Array<{ id: string; tokenPrefix: string }>;
  tickets: Array<{
    status?: 'ok' | 'error';
    id?: string;
    message?: string;
    details?: { error?: string };
  }>;
  message?: string;
};

export type NotificationPreferences = {
  id?: string;
  userId?: string;
  messages: boolean;
  offerUpdates: boolean;
  jobCompletion: boolean;
  reviews: boolean;
  paymentsRefunds: boolean;
  newJobsNearMe: boolean;
  systemAlerts: boolean;
  adminAlerts: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ContractorServiceLocation = {
  id: string;
  contractorId: string;
  locationKey: string;
  locationLabel: string;
  createdAt: string;
};

export type ServiceLocationOption = {
  key: string;
  label: string;
};

export type ContractorServiceAreasResponse = {
  availableLocations: ServiceLocationOption[];
  locations: ContractorServiceLocation[];
};

export type ContractorServiceCategory = {
  id: string;
  contractorId: string;
  categoryKey: string;
  categoryLabel: string;
  subcategoryKey?: string | null;
  subcategoryLabel?: string | null;
  createdAt: string;
};

export type ContractorServiceCategoriesResponse = {
  categories: ContractorServiceCategory[];
};

export type OfferWorkDetails = {
  offer: Offer & {
    unlockStatus: UnlockStatus;
    reviewId?: string | null;
  };
  job: JobRequest;
  contactUnlock?: Pick<
    ContactUnlock,
    'id' | 'jobRequestId' | 'offerId' | 'employerId' | 'contractorId' | 'status' | 'createdAt' | 'updatedAt'
  > | null;
  completion?: JobCompletion | null;
  review?: Review | null;
  employerReview?: EmployerReview | null;
  conversation?: Pick<Conversation, 'id' | 'contactUnlockId' | 'lastMessageAt' | 'createdAt' | 'updatedAt'> | null;
  employer?: AuthUser | null;
  employerRatingSummary?: EmployerRatingSummary;
  contractor?: Pick<AuthUser, 'id' | 'email' | 'status'> & {
    profile?: Partial<UserProfile> | null;
    ratingSummary?: Pick<ContractorRatingSummary, 'averageRating' | 'totalReviews'> | null;
    portfolioImages: ContractorPortfolioImage[];
    verificationStatus: ContractorVerificationStatus;
  };
  availableActions: WorkDetailsAction[];
};

export type ActivitySummary =
  | {
      role: 'CONTRACTOR';
      myOffersCount: number;
      selectedOffersCount: number;
      unlockedContactsCount: number;
      jobsInProgressCount: number;
      completedJobsCount: number;
      myReviewsCount: number;
    }
  | {
      role: 'EMPLOYER' | 'ADMIN';
      myJobsCount: number;
      offersReceivedCount: number;
      selectedOffersCount: number;
      unlockedContactsCount: number;
      jobsInProgressCount: number;
      jobsWaitingConfirmationCount: number;
      reviewsToLeaveCount: number;
      alertsCount: number;
      completedJobsCount?: number;
    };

export type AuditLog = {
  id: string;
  adminId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  admin?: AuthUser;
};

export type ReportTargetSummary = {
  title: string;
  subtitle?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type Report = {
  id: string;
  reporterId?: string;
  reporter?: AuthUser;
  targetType: ReportTargetType;
  targetId: string;
  targetSummary?: ReportTargetSummary;
  reason: ReportReason;
  description?: string | null;
  status: ReportStatus;
  reviewedByAdminId?: string | null;
  reviewedByAdmin?: Pick<AuthUser, 'id' | 'email' | 'profile'> | null;
  adminNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminStatistics = {
  users: {
    total: number;
    employers: number;
    contractors: number;
    admins: number;
    active: number;
    suspended: number;
  };
  jobs: {
    total: number;
    active: number;
    inProgress: number;
    completed: number;
    closed: number;
    expired: number;
  };
  offers: {
    total: number;
    pending: number;
    selected: number;
    withdrawn: number;
    rejected: number;
    completed: number;
  };
  tokens: {
    totalPurchased: number;
    totalSpent: number;
    totalRefunded: number;
    activeTokenBalance: number;
    purchaseRevenue: number;
    mockRevenue: number;
    promoTokensGranted: number;
    welcomeBonusTokensGranted: number;
    adminGrantedTokens: number;
    adminRevokedTokens: number;
  };
  reviews: {
    total: number;
    active: number;
    removed: number;
    averageRating: number;
  };
  conversations: {
    total: number;
    messages: number;
  };
  refunds: {
    pending: number;
    approved: number;
    rejected: number;
  };
  payments: {
    total: number;
    paid: number;
    failed: number;
    pending: number;
    testRevenue: number;
  };
};
