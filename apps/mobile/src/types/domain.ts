export type UserRole = 'EMPLOYER' | 'CONTRACTOR' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';
export type JobStatus = 'ACTIVE' | 'EXPIRED' | 'COMPLETED' | 'CLOSED';
export type OfferStatus = 'PENDING' | 'SELECTED' | 'REJECTED' | 'WITHDRAWN';
export type TokenTransactionType = 'PURCHASE' | 'SPEND' | 'REFUND';
export type RefundStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type UnlockStatus = 'LOCKED' | 'PENDING' | 'UNLOCKED';
export type JobCompletionStatus = 'PENDING_EMPLOYER_CONFIRMATION' | 'CONFIRMED' | 'DISPUTED' | 'CANCELLED';
export type ReviewStatus = 'ACTIVE' | 'REMOVED';
export type NotificationType =
  | 'NEW_OFFER'
  | 'NEW_MESSAGE'
  | 'CONTACT_UNLOCKED'
  | 'REFUND_APPROVED'
  | 'REFUND_DENIED'
  | 'JOB_COMPLETED'
  | 'REVIEW_RECEIVED'
  | 'REVIEW_REPLIED'
  | 'REVIEW_REMOVED';

export type UserProfile = {
  id: string;
  userId: string;
  displayName: string;
  phone?: string | null;
  location?: string | null;
  bio?: string | null;
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

export type JobImage = {
  id: string;
  jobRequestId: string;
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
  estimatedCompletionDays: number;
  message?: string | null;
  status: OfferStatus;
  selectedByEmployer: boolean;
  unlockStatus?: UnlockStatus;
  contactId?: string | null;
  deletedAt?: string | null;
  rating?: number | null;
  totalReviews?: number;
  createdAt: string;
  updatedAt: string;
  jobRequest?: JobRequest;
  employer?: AuthUser;
  contractor?: AuthUser;
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
};

export type JobBrowseFilters = {
  category?: string;
  subcategory?: string;
  location?: string;
  sortBy?: 'newest' | 'oldest';
  page?: number;
  limit?: number;
};

export type OfferFormValues = {
  estimatedPrice: number;
  estimatedCompletionDays: number;
  message?: string;
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
    'id' | 'estimatedPrice' | 'estimatedCompletionDays' | 'message' | 'status' | 'selectedByEmployer' | 'createdAt' | 'updatedAt'
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
    'id' | 'estimatedPrice' | 'estimatedCompletionDays' | 'message' | 'status' | 'selectedByEmployer' | 'createdAt' | 'updatedAt'
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
    'id' | 'estimatedPrice' | 'estimatedCompletionDays' | 'message' | 'status' | 'selectedByEmployer' | 'createdAt' | 'updatedAt'
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

export type CompletionStatusResponse = {
  contactId: string;
  jobRequestId: string;
  offerId: string;
  status?: JobCompletionStatus | null;
  canReview: boolean;
  completion?: JobCompletion | null;
  review?: Review | null;
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
