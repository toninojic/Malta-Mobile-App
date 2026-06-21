import {
  AuthResponse,
  AuthUser,
  ActivitySummary,
  AnalyticsEvent,
  AnalyticsEventInput,
  AdminAnalyticsErrors,
  AdminAnalyticsFunnels,
  AdminAnalyticsOverview,
  AiJobAssistantState,
  AiMessageResponse,
  AiPublishResponse,
  AdminTokenAdjustmentResponse,
  AdminStatistics,
  AdminUser,
  AuditLog,
  ChatMessage,
  CompletionStatusResponse,
  ContactUnlock,
  ContractorProfile,
  ContractorPortfolioImage,
  ContractorRatingSummary,
  ContractorVerification,
  Conversation,
  EmployerRatingSummary,
  EmployerReview,
  EmailVerificationResponse,
  ForgotPasswordResponse,
  InAppNotification,
  JobCompletion,
  JobBrowseFilters,
  JobFormValues,
  JobRequest,
  Offer,
  OfferFormValues,
  OfferWorkDetails,
  OfferStatus,
  PaginatedResponse,
  Payment,
  PaymentConfig,
  PushToken,
  PushTestDebugResponse,
  PushTokenDebugResponse,
  RefundRequest,
  RefundStatus,
  ResetPasswordResponse,
  Report,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  Review,
  ContractorServiceAreasResponse,
  ContractorServiceCategoriesResponse,
  NotificationPreferences,
  TokenBalance,
  TokenPackage,
  TokenTransaction,
  WelcomeBonusResponse,
  UnlockResult,
  UnlockStatusResponse,
  UploadedJobImage,
  UserProfile,
  UserRole,
  UserStatus,
  AiJobDraft,
} from '../types/domain';
import { getAccessToken, getRefreshToken, useAuthStore } from '../store/auth.store';
import { apiConfig } from '../config/apiConfig';
import { MALTA_SERVICE_LOCATIONS } from '../config/maltaLocations';
import { track, trackApiFailure } from '../services/analytics';

const API_URL = apiConfig.baseUrl;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  formData?: FormData;
  authenticated?: boolean;
  retryOnUnauthorized?: boolean;
  debugLabel?: 'login';
};

type UploadableFile = { uri: string; name: string; type: string };
type StorageFolder = 'avatars' | 'portfolio' | 'jobs' | 'verification';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export class ApiNetworkError extends Error {
  constructor(
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path);
  const method = options.method ?? 'GET';
  const isMultipart = Boolean(options.formData);
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }

  if (apiConfig.shouldSkipNgrokBrowserWarning) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }

  const accessToken = getAccessToken();
  if (options.authenticated !== false && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  validateApiConfig();
  logRequest(options, method, url);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: options.formData ?? (options.body ? JSON.stringify(options.body) : undefined),
    });
  } catch (error) {
    logNetworkError(method, url, error);
    throw new ApiNetworkError(
      `Network request failed. API URL: ${API_URL || '[missing]'}. Request URL: ${url}. ${
        error instanceof Error ? error.message : 'Unknown network error.'
      }`,
      error,
    );
  }

  if (response.status === 401 && options.retryOnUnauthorized !== false) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return request<T>(path, { ...options, retryOnUnauthorized: false });
    }
  }

  const contentType = response.headers.get('content-type');
  const payload = contentType?.includes('application/json') ? await response.json() : null;

  logResponse(options, response.status, payload);

  if (!response.ok) {
    const message = extractErrorMessage(response.status, payload);
    trackApiFailure({ path, method, status: response.status, message });
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

function buildUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_URL}${normalizedPath}`;
}

function validateApiConfig() {
  if (apiConfig.deviceTestingError) {
    throw new ApiNetworkError(`${apiConfig.deviceTestingError} Resolved API URL: ${API_URL || '[missing]'}.`);
  }
}

function extractErrorMessage(status: number, payload: unknown) {
  const message = getPayloadMessage(payload);

  if (status === 429) {
    return 'Too many refreshes. Please wait a moment.';
  }

  if (status === 401 && message === 'Invalid credentials.') {
    return 'Invalid email or password.';
  }

  return message ?? 'Invalid request.';
}

function getPayloadMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const maybePayload = payload as { message?: unknown; error?: unknown };
  if (typeof maybePayload.message === 'string' && maybePayload.message.trim()) {
    return maybePayload.message;
  }

  if (Array.isArray(maybePayload.message) && maybePayload.message.length) {
    return maybePayload.message.map(String).join('\n');
  }

  if (typeof maybePayload.error === 'string' && maybePayload.error.trim()) {
    return maybePayload.error;
  }

  return null;
}

function logRequest(options: RequestOptions, method: string, url: string) {
  if (!apiConfig.shouldLogDiagnostics) {
    return;
  }

  const bodyKeys = options.body && typeof options.body === 'object' ? Object.keys(options.body) : [];
  console.info('[api:request]', {
    method,
    url,
    bodyKeys,
  });
}

function logResponse(options: RequestOptions, status: number, payload: unknown) {
  if (!apiConfig.shouldLogDiagnostics) {
    return;
  }

  console.info('[api:response]', {
    status,
    body: sanitizeLogPayload(payload),
    message: getPayloadMessage(payload),
  });
}

function logNetworkError(method: string, url: string, error: unknown) {
  console.warn('[api:network-error]', {
    baseUrl: API_URL || '[missing]',
    method,
    url,
    message: error instanceof Error ? error.message : String(error),
  });
}

function sanitizeLogPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map(sanitizeLogPayload);
  }

  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      key.toLowerCase().includes('token') ? '[redacted]' : sanitizeLogPayload(value),
    ]),
  );
}

function queryString(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : '';
}

async function refreshSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  try {
    const session = await request<AuthResponse>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      authenticated: false,
      retryOnUnauthorized: false,
    });
    await useAuthStore.getState().setSession(session);
    return true;
  } catch {
    await useAuthStore.getState().clearSession();
    return false;
  }
}

export const api = {
  register(input: {
    email: string;
    password: string;
    role: Exclude<UserRole, 'ADMIN'>;
    displayName?: string;
    phone?: string;
    location?: string;
    companyName?: string;
    tradeCategories?: string[];
    termsAccepted: boolean;
    privacyAccepted: boolean;
  }) {
    track(input.role === 'EMPLOYER' ? 'EMPLOYER_REGISTER_STARTED' : 'CONTRACTOR_REGISTER_STARTED', { screen: 'Register' });
    return request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: input,
      authenticated: false,
    }).then((session) => {
      track(session.user.role === 'EMPLOYER' ? 'EMPLOYER_REGISTER_COMPLETED' : 'CONTRACTOR_REGISTER_COMPLETED', {
        screen: 'Register',
        entityType: 'USER',
        entityId: session.user.id,
      });
      return session;
    }).catch((error) => {
      track('VALIDATION_ERROR', { screen: 'Register', metadata: { action: 'register' } });
      throw error;
    });
  },
  login(input: { email: string; password: string }) {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: {
        email: input.email.trim().toLowerCase(),
        password: input.password,
      },
      authenticated: false,
      debugLabel: 'login',
    });
  },
  googleAuth(input: {
    idToken: string;
    role?: Exclude<UserRole, 'ADMIN'>;
    termsAccepted?: boolean;
    privacyAccepted?: boolean;
  }) {
    return request<AuthResponse>('/auth/google', {
      method: 'POST',
      body: input,
      authenticated: false,
    }).then((session) => {
      track('GOOGLE_LOGIN_COMPLETED', {
        screen: input.role ? 'Register' : 'Login',
        entityType: 'USER',
        entityId: session.user.id,
        metadata: { role: session.user.role },
      });
      return session;
    }).catch((error) => {
      track('GOOGLE_LOGIN_FAILED', { screen: input.role ? 'Register' : 'Login' });
      throw error;
    });
  },
  sendEmailVerification() {
    return request<EmailVerificationResponse>('/auth/send-email-verification', {
      method: 'POST',
    });
  },
  verifyEmail(token: string) {
    return request<EmailVerificationResponse>('/auth/verify-email', {
      method: 'POST',
      body: { token },
      authenticated: false,
    }).then((response) => {
      track('EMAIL_VERIFIED', { screen: 'VerifyEmail', entityType: 'USER', entityId: response.user?.id });
      return response;
    }).catch((error) => {
      track('EMAIL_VERIFY_FAILED', { screen: 'VerifyEmail' });
      throw error;
    });
  },
  forgotPassword(email: string) {
    track('PASSWORD_RESET_REQUESTED', { screen: 'ForgotPassword' });
    return request<ForgotPasswordResponse>('/auth/forgot-password', {
      method: 'POST',
      body: { email },
      authenticated: false,
    });
  },
  resetPassword(input: { token: string; newPassword: string }) {
    return request<ResetPasswordResponse>('/auth/reset-password', {
      method: 'POST',
      body: input,
      authenticated: false,
    }).then((response) => {
      track('PASSWORD_RESET_COMPLETED', { screen: 'ResetPassword', entityType: 'USER', entityId: response.user?.id });
      return response;
    });
  },
  logout() {
    return request<{ success: true }>('/auth/logout', { method: 'POST' });
  },
  me() {
    return request<AuthUser>('/auth/me');
  },
  profile() {
    return request<AuthUser>('/users/me');
  },
  updateProfile(input: Partial<UserProfile>) {
    return request<UserProfile>('/users/me/profile', {
      method: 'PATCH',
      body: input,
    });
  },
  deleteAccount() {
    return request<{ success: true; status: UserStatus; message: string }>('/users/me', {
      method: 'DELETE',
    });
  },
  storageUploadUrl(input: {
    folder: StorageFolder;
    fileName: string;
    contentType: string;
    jobId?: string;
  }) {
    return request<{ key: string; uploadUrl: string }>('/storage/upload-url', {
      method: 'POST',
      body: input,
    });
  },
  storageViewUrl(key: string) {
    return request<{ url: string }>(`/storage/view-url${queryString({ key })}`);
  },
  deleteStorageObject(key: string) {
    return request<{ success: true }>('/storage', {
      method: 'DELETE',
      body: { key },
    });
  },
  async uploadAvatar(image: UploadableFile) {
    const uploaded = await uploadFileToS3('avatars', image);
    return {
      avatarKey: uploaded.key,
      avatarUrl: uploaded.key,
    };
  },
  jobsMine() {
    return request<JobRequest[]>('/jobs/mine');
  },
  browseJobs(filters: JobBrowseFilters = {}) {
    return request<PaginatedResponse<JobRequest>>(
      `/jobs${queryString({
        category: filters.category?.trim(),
        subcategory: filters.subcategory?.trim(),
        search: filters.search?.trim(),
        location: filters.location?.trim(),
        sortBy: filters.sortBy,
        page: filters.page,
        limit: filters.limit,
      })}`,
    );
  },
  job(id: string) {
    return request<JobRequest>(`/jobs/${id}`);
  },
  createJob(input: JobFormValues) {
    track('JOB_CREATE_STARTED', {
      screen: 'JobForm',
      metadata: { category: input.category, subcategory: input.subcategory, location: input.location },
    });
    return request<JobRequest>('/jobs', {
      method: 'POST',
      body: input,
    }).then((job) => {
      track('JOB_CREATED', {
        screen: 'JobForm',
        entityType: 'JOB',
        entityId: job.id,
        metadata: { category: job.category, subcategory: job.subcategory, location: job.location },
      });
      return job;
    }).catch((error) => {
      track('JOB_CREATE_FAILED', {
        screen: 'JobForm',
        metadata: { category: input.category, subcategory: input.subcategory, location: input.location },
      });
      throw error;
    });
  },
  updateJob(id: string, input: JobFormValues) {
    return request<JobRequest>(`/jobs/${id}`, {
      method: 'PATCH',
      body: input,
    }).then((job) => {
      track('JOB_EDITED', { screen: 'JobForm', entityType: 'JOB', entityId: job.id });
      return job;
    });
  },
  renewJob(id: string) {
    return request<JobRequest>(`/jobs/${id}/renew`, {
      method: 'POST',
    });
  },
  deleteJob(id: string) {
    return request<{ success: true; job: JobRequest }>(`/jobs/${id}`, {
      method: 'DELETE',
    });
  },
  aiJobAssistantCurrent() {
    return request<AiJobAssistantState>('/ai/job-assistant/conversations/current');
  },
  createAiJobAssistantConversation() {
    track('AI_ASSISTANT_OPENED', { screen: 'AiJobAssistant' });
    return request<AiJobAssistantState>('/ai/job-assistant/conversations', {
      method: 'POST',
    });
  },
  sendAiJobAssistantMessage(input: { conversationId: string; message: string }) {
    return request<AiMessageResponse>('/ai/job-assistant/messages', {
      method: 'POST',
      body: input,
    });
  },
  aiJobAssistantUsage() {
    return request<AiJobAssistantState['usage']>('/ai/job-assistant/usage');
  },
  publishAiJobDraft(draftId: string) {
    return request<AiPublishResponse>(`/ai/job-assistant/draft/${draftId}/publish`, {
      method: 'POST',
    });
  },
  discardAiJobDraft(draftId: string) {
    return request<{ success: true; draft: AiJobDraft }>(`/ai/job-assistant/draft/${draftId}/discard`, {
      method: 'POST',
    });
  },
  offersForJob(jobId: string, input: { page?: number; limit?: number; status?: OfferStatus } = {}) {
    return request<PaginatedResponse<Offer>>(
      `/jobs/${jobId}/offers${queryString({ page: input.page, limit: input.limit, status: input.status })}`,
    );
  },
  myOffers(input: { page?: number; limit?: number; status?: OfferStatus } = {}) {
    return request<PaginatedResponse<Offer>>(
      `/offers/mine${queryString({ page: input.page, limit: input.limit, status: input.status })}`,
    );
  },
  createOffer(jobId: string, input: OfferFormValues) {
    track('OFFER_CREATE_STARTED', { screen: 'OfferForm', entityType: 'JOB', entityId: jobId });
    return request<Offer>(`/jobs/${jobId}/offers`, {
      method: 'POST',
      body: input,
    }).then((offer) => {
      track('OFFER_CREATED', { screen: 'OfferForm', entityType: 'OFFER', entityId: offer.id });
      return offer;
    }).catch((error) => {
      track('OFFER_CREATE_FAILED', { screen: 'OfferForm', entityType: 'JOB', entityId: jobId });
      throw error;
    });
  },
  updateOffer(offerId: string, input: OfferFormValues) {
    return request<Offer>(`/offers/${offerId}`, {
      method: 'PATCH',
      body: input,
    }).then((offer) => {
      track('OFFER_EDITED', { screen: 'OfferForm', entityType: 'OFFER', entityId: offer.id });
      return offer;
    });
  },
  offerWorkDetails(offerId: string) {
    return request<OfferWorkDetails>(`/offers/${offerId}/work-details`);
  },
  selectOffer(offerId: string) {
    return request<Offer>(`/offers/${offerId}/select`, {
      method: 'POST',
    }).then((offer) => {
      track('OFFER_SELECTED', { screen: 'JobDetails', entityType: 'OFFER', entityId: offer.id });
      return offer;
    });
  },
  rejectOffer(offerId: string) {
    return request<Offer>(`/offers/${offerId}/reject`, {
      method: 'POST',
    });
  },
  cancelOfferSelection(offerId: string) {
    return request<Offer>(`/offers/${offerId}/cancel-selection`, {
      method: 'POST',
    }).then((offer) => {
      track('OFFER_SELECTION_CANCELLED', { screen: 'JobDetails', entityType: 'OFFER', entityId: offer.id });
      return offer;
    });
  },
  withdrawOffer(offerId: string) {
    return request<Offer>(`/offers/${offerId}/withdraw`, {
      method: 'POST',
    }).then((offer) => {
      track('OFFER_WITHDRAWN', { screen: 'OfferWorkDetails', entityType: 'OFFER', entityId: offer.id });
      return offer;
    });
  },
  tokenPackages() {
    return request<TokenPackage[]>('/tokens/packages');
  },
  tokenBalance() {
    return request<TokenBalance>('/tokens/balance');
  },
  tokenTransactions(input: { page?: number; limit?: number } = {}) {
    return request<PaginatedResponse<TokenTransaction>>(
      `/tokens/transactions${queryString({ page: input.page, limit: input.limit })}`,
    );
  },
  claimWelcomeBonus() {
    return request<WelcomeBonusResponse>('/tokens/welcome-bonus/claim', {
      method: 'POST',
    });
  },
  skipWelcomeBonusOnboarding() {
    return request<{ success: true }>('/tokens/welcome-bonus/skip', {
      method: 'POST',
    });
  },
  mockPurchase(tokenPackageId: string) {
    track('TOKEN_PURCHASE_STARTED', { screen: 'Wallet', entityType: 'TOKEN', entityId: tokenPackageId });
    return request<{ balance: TokenBalance; transaction: TokenTransaction }>('/tokens/mock-purchase', {
      method: 'POST',
      body: { tokenPackageId },
    }).then((result) => {
      track('TOKEN_PURCHASE_COMPLETED', { screen: 'Wallet', entityType: 'TOKEN', entityId: tokenPackageId });
      return result;
    }).catch((error) => {
      track('TOKEN_PURCHASE_FAILED', { screen: 'Wallet', entityType: 'TOKEN', entityId: tokenPackageId });
      throw error;
    });
  },
  paymentConfig() {
    return request<PaymentConfig>('/payments/config');
  },
  payments(input: { page?: number; limit?: number } = {}) {
    return request<PaginatedResponse<Payment>>(
      `/payments${queryString({ page: input.page, limit: input.limit })}`,
    );
  },
  createRefund(input: { tokenTransactionId: string; reason: string }) {
    return request<RefundRequest>('/tokens/refunds', {
      method: 'POST',
      body: input,
    });
  },
  myRefunds(input: { page?: number; limit?: number; status?: RefundStatus } = {}) {
    return request<PaginatedResponse<RefundRequest>>(
      `/tokens/refunds/mine${queryString({ page: input.page, limit: input.limit, status: input.status })}`,
    );
  },
  createTokenPackage(input: {
    title: string;
    tokenCount: number;
    price: number;
    currency?: string;
    isActive?: boolean;
  }) {
    return request<TokenPackage>('/admin/tokens/packages', {
      method: 'POST',
      body: input,
    });
  },
  updateTokenPackage(
    id: string,
    input: Partial<{
      title: string;
      tokenCount: number;
      price: number;
      currency: string;
      isActive: boolean;
    }>,
  ) {
    return request<TokenPackage>(`/admin/tokens/packages/${id}`, {
      method: 'PATCH',
      body: input,
    });
  },
  adminRefunds(input: { page?: number; limit?: number; status?: RefundStatus } = {}) {
    return request<PaginatedResponse<RefundRequest>>(
      `/admin/tokens/refunds${queryString({ page: input.page, limit: input.limit, status: input.status })}`,
    );
  },
  approveRefund(refundRequestId: string, adminNote?: string) {
    return request<RefundRequest>(`/admin/tokens/refunds/${refundRequestId}/approve`, {
      method: 'POST',
      body: { adminNote },
    });
  },
  rejectRefund(refundRequestId: string, adminNote?: string) {
    return request<RefundRequest>(`/admin/tokens/refunds/${refundRequestId}/reject`, {
      method: 'POST',
      body: { adminNote },
    });
  },
  unlockOffer(offerId: string) {
    track('CONTACT_UNLOCK_STARTED', { screen: 'OfferWorkDetails', entityType: 'OFFER', entityId: offerId });
    return request<UnlockResult>(`/offers/${offerId}/unlock`, {
      method: 'POST',
    }).then((result) => {
      track('CONTACT_UNLOCKED', { screen: 'OfferWorkDetails', entityType: 'OFFER', entityId: offerId });
      return result;
    }).catch((error) => {
      track('CONTACT_UNLOCK_FAILED', { screen: 'OfferWorkDetails', entityType: 'OFFER', entityId: offerId });
      throw error;
    });
  },
  requestContact(offerId: string) {
    return request<UnlockStatusResponse>(`/offers/${offerId}/request-contact`, {
      method: 'POST',
    });
  },
  unlockStatus(offerId: string) {
    return request<UnlockStatusResponse>(`/offers/${offerId}/unlock-status`);
  },
  contacts(input: { page?: number; limit?: number } = {}) {
    return request<PaginatedResponse<ContactUnlock>>(
      `/contacts${queryString({ page: input.page, limit: input.limit })}`,
    );
  },
  contactsReadyForReview(input: { page?: number; limit?: number } = {}) {
    return request<PaginatedResponse<ContactUnlock>>(
      `/contacts/reviews-to-leave${queryString({ page: input.page, limit: input.limit })}`,
    );
  },
  contact(contactId: string) {
    return request<ContactUnlock>(`/contacts/${contactId}`);
  },
  adminContacts(input: { page?: number; limit?: number } = {}) {
    return request<PaginatedResponse<ContactUnlock>>(
      `/admin/contacts${queryString({ page: input.page, limit: input.limit })}`,
    );
  },
  adminContact(contactId: string) {
    return request<ContactUnlock>(`/admin/contacts/${contactId}`);
  },
  completeContact(contactId: string) {
    return request<JobCompletion>(`/contacts/${contactId}/complete`, {
      method: 'POST',
    }).then((completion) => {
      track('JOB_MARKED_COMPLETED', { screen: 'ContactDetails', entityType: 'CONTACT', entityId: contactId });
      return completion;
    });
  },
  confirmCompletion(contactId: string) {
    return request<JobCompletion>(`/contacts/${contactId}/confirm-completion`, {
      method: 'POST',
    }).then((completion) => {
      track('COMPLETION_CONFIRMED', { screen: 'ContactDetails', entityType: 'CONTACT', entityId: contactId });
      return completion;
    });
  },
  completionStatus(contactId: string) {
    return request<CompletionStatusResponse>(`/contacts/${contactId}/completion-status`);
  },
  createReview(contactId: string, input: { rating: number; comment?: string }) {
    return request<Review>(`/contacts/${contactId}/review`, {
      method: 'POST',
      body: input,
    }).then((review) => {
      track('CONTRACTOR_REVIEW_LEFT', { screen: 'LeaveReview', entityType: 'REVIEW', entityId: review.id });
      return review;
    });
  },
  createEmployerReview(contactId: string, input: { rating: number; comment?: string }) {
    return request<EmployerReview>(`/contacts/${contactId}/employer-review`, {
      method: 'POST',
      body: input,
    }).then((review) => {
      track('EMPLOYER_REVIEW_LEFT', { screen: 'LeaveReview', entityType: 'REVIEW', entityId: review.id });
      return review;
    });
  },
  review(reviewId: string) {
    return request<Review>(`/reviews/${reviewId}`);
  },
  employerReview(reviewId: string) {
    return request<EmployerReview>(`/employer-reviews/${reviewId}`);
  },
  contractorReviews(contractorId: string, input: { page?: number; limit?: number } = {}) {
    return request<PaginatedResponse<Review>>(
      `/contractors/${contractorId}/reviews${queryString({ page: input.page, limit: input.limit })}`,
    );
  },
  contractorRatingSummary(contractorId: string) {
    return request<ContractorRatingSummary>(`/contractors/${contractorId}/rating-summary`);
  },
  employerReviews(employerId: string, input: { page?: number; limit?: number } = {}) {
    return request<PaginatedResponse<EmployerReview>>(
      `/employers/${employerId}/reviews${queryString({ page: input.page, limit: input.limit })}`,
    );
  },
  employerRatingSummary(employerId: string) {
    return request<EmployerRatingSummary>(`/employers/${employerId}/rating-summary`);
  },
  myGivenReviews(input: { page?: number; limit?: number } = {}) {
    return request<PaginatedResponse<Review | EmployerReview>>(
      `/reviews/mine/given${queryString({ page: input.page, limit: input.limit })}`,
    );
  },
  createReport(input: {
    targetType: ReportTargetType;
    targetId: string;
    reason: ReportReason;
    description?: string;
  }) {
    track('REPORT_STARTED', { screen: 'ReportForm', entityType: input.targetType, entityId: input.targetId });
    return request<Report>('/reports', {
      method: 'POST',
      body: input,
    }).then((report) => {
      track('REPORT_SUBMITTED', { screen: 'ReportForm', entityType: 'REPORT', entityId: report.id });
      return report;
    }).catch((error) => {
      track('REPORT_FAILED', { screen: 'ReportForm', entityType: input.targetType, entityId: input.targetId });
      throw error;
    });
  },
  myReports(input: {
    page?: number;
    limit?: number;
    status?: ReportStatus;
    targetType?: ReportTargetType;
    reason?: ReportReason;
  } = {}) {
    return request<PaginatedResponse<Report>>(
      `/reports/mine${queryString({
        page: input.page,
        limit: input.limit,
        status: input.status,
        targetType: input.targetType,
        reason: input.reason,
      })}`,
    );
  },
  report(reportId: string) {
    return request<Report>(`/reports/${reportId}`);
  },
  contractorProfile(contractorId: string) {
    return request<ContractorProfile>(`/contractors/${contractorId}/profile`);
  },
  replyReview(reviewId: string, contractorReply: string) {
    return request<Review>(`/reviews/${reviewId}/reply`, {
      method: 'PATCH',
      body: { contractorReply },
    });
  },
  adminReviews(input: { page?: number; limit?: number } = {}) {
    return request<PaginatedResponse<Review>>(
      `/admin/reviews${queryString({ page: input.page, limit: input.limit })}`,
    );
  },
  adminReview(reviewId: string) {
    return request<Review>(`/admin/reviews/${reviewId}`);
  },
  removeReview(reviewId: string) {
    return request<Review>(`/admin/reviews/${reviewId}/remove`, {
      method: 'PATCH',
    });
  },
  conversations(input: { page?: number; limit?: number } = {}) {
    return request<PaginatedResponse<Conversation>>(
      `/conversations${queryString({ page: input.page, limit: input.limit })}`,
    );
  },
  conversation(id: string) {
    return request<Conversation>(`/conversations/${id}`);
  },
  ensureConversationForContact(contactId: string) {
    return request<Conversation>(`/conversations/contacts/${contactId}`, {
      method: 'POST',
    });
  },
  conversationMessages(id: string) {
    return request<ChatMessage[]>(`/conversations/${id}/messages`);
  },
  sendMessage(id: string, content: string) {
    track('MESSAGE_SEND_STARTED', { screen: 'ConversationThread', entityType: 'CONVERSATION', entityId: id });
    return request<{ conversation: Conversation; message: ChatMessage }>(`/conversations/${id}/messages`, {
      method: 'POST',
      body: { content },
    }).then((result) => {
      track('MESSAGE_SENT', { screen: 'ConversationThread', entityType: 'MESSAGE', entityId: result.message.id });
      return result;
    }).catch((error) => {
      track('MESSAGE_SEND_FAILED', { screen: 'ConversationThread', entityType: 'CONVERSATION', entityId: id });
      throw error;
    });
  },
  markMessageRead(messageId: string) {
    return request<ChatMessage>(`/messages/${messageId}/read`, {
      method: 'PATCH',
    });
  },
  adminConversations(input: { page?: number; limit?: number } = {}) {
    return request<PaginatedResponse<Conversation>>(
      `/admin/conversations${queryString({ page: input.page, limit: input.limit })}`,
    );
  },
  adminConversation(id: string) {
    return request<Conversation>(`/admin/conversations/${id}`);
  },
  notifications(input: { page?: number; limit?: number } = {}) {
    return request<PaginatedResponse<InAppNotification>>(
      `/notifications${queryString({ page: input.page, limit: input.limit })}`,
    );
  },
  unreadNotificationCount() {
    return request<{ count: number }>('/notifications/unread-count');
  },
  markNotificationRead(notificationId: string) {
    return request<InAppNotification>(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });
  },
  markAllNotificationsRead() {
    return request<{ success: true }>('/notifications/read-all', {
      method: 'PATCH',
    });
  },
  notificationPreferences() {
    return request<NotificationPreferences>('/notifications/preferences');
  },
  updateNotificationPreferences(input: Partial<NotificationPreferences>) {
    return request<NotificationPreferences>('/notifications/preferences', {
      method: 'PATCH',
      body: input,
    });
  },
  registerPushToken(input: {
    expoPushToken: string;
    platform: 'ios' | 'android' | 'web' | 'unknown';
    deviceId?: string;
    deviceName?: string;
  }) {
    return request<PushToken>('/push-tokens', {
      method: 'POST',
      body: input,
    });
  },
  pushTokens() {
    return request<PushToken[]>('/push-tokens/mine');
  },
  deactivatePushToken(id: string) {
    return request<{ success: true }>(`/push-tokens/${id}`, {
      method: 'DELETE',
    });
  },
  notificationDebugPushTokens() {
    return request<PushTokenDebugResponse>('/notifications/debug/push-tokens');
  },
  sendTestPushNotification() {
    return request<PushTestDebugResponse>('/notifications/debug/send-test', {
      method: 'POST',
    });
  },
  adminNotifications(input: { page?: number; limit?: number } = {}) {
    return request<PaginatedResponse<InAppNotification>>(
      `/admin/notifications${queryString({ page: input.page, limit: input.limit })}`,
    );
  },
  activitySummary() {
    return request<ActivitySummary>('/activity/summary');
  },
  adminStatistics() {
    return request<AdminStatistics>('/admin/statistics');
  },
  trackAnalyticsEvent(input: AnalyticsEventInput) {
    return request<AnalyticsEvent>('/analytics/events', {
      method: 'POST',
      body: input,
      authenticated: false,
      retryOnUnauthorized: false,
    });
  },
  trackAnalyticsBatch(events: AnalyticsEventInput[]) {
    return request<{ created: number }>('/analytics/events/batch', {
      method: 'POST',
      body: { events },
      authenticated: false,
      retryOnUnauthorized: false,
    });
  },
  adminAnalyticsOverview() {
    return request<AdminAnalyticsOverview>('/admin/analytics/overview');
  },
  adminAnalyticsFunnels() {
    return request<AdminAnalyticsFunnels>('/admin/analytics/funnels');
  },
  adminAnalyticsErrors() {
    return request<AdminAnalyticsErrors>('/admin/analytics/errors');
  },
  adminAnalyticsEvents(input: { page?: number; limit?: number; role?: UserRole; eventName?: string; screen?: string } = {}) {
    return request<PaginatedResponse<AnalyticsEvent>>(
      `/admin/analytics/events${queryString({
        page: input.page,
        limit: input.limit,
        role: input.role,
        eventName: input.eventName?.trim(),
        screen: input.screen?.trim(),
      })}`,
    );
  },
  adminUsers(input: { page?: number; limit?: number; role?: UserRole; status?: UserStatus; search?: string } = {}) {
    return request<PaginatedResponse<AdminUser>>(
      `/admin/users${queryString({
        page: input.page,
        limit: input.limit,
        role: input.role,
        status: input.status,
        search: input.search?.trim(),
      })}`,
    );
  },
  adminUser(userId: string) {
    return request<AdminUser>(`/admin/users/${userId}`);
  },
  suspendUser(userId: string) {
    return request<AdminUser>(`/admin/users/${userId}/suspend`, {
      method: 'PATCH',
    });
  },
  activateUser(userId: string) {
    return request<AdminUser>(`/admin/users/${userId}/activate`, {
      method: 'PATCH',
    });
  },
  adminGrantTokens(userId: string, input: { amount?: number; reason: string }) {
    return request<AdminTokenAdjustmentResponse>(`/admin/users/${userId}/tokens/grant`, {
      method: 'POST',
      body: input,
    });
  },
  adminRevokeTokens(userId: string, input: { amount: number; reason: string }) {
    return request<AdminTokenAdjustmentResponse>(`/admin/users/${userId}/tokens/revoke`, {
      method: 'POST',
      body: input,
    });
  },
  adminJobs(input: { page?: number; limit?: number; status?: string; category?: string; location?: string; employerId?: string } = {}) {
    return request<PaginatedResponse<JobRequest>>(
      `/admin/jobs${queryString({
        page: input.page,
        limit: input.limit,
        status: input.status,
        category: input.category?.trim(),
        location: input.location?.trim(),
        employerId: input.employerId,
      })}`,
    );
  },
  adminJob(jobId: string) {
    return request<JobRequest>(`/admin/jobs/${jobId}`);
  },
  closeAdminJob(jobId: string) {
    return request<JobRequest>(`/admin/jobs/${jobId}/close`, {
      method: 'PATCH',
    });
  },
  adminOffers(input: { page?: number; limit?: number; status?: OfferStatus; jobRequestId?: string; contractorId?: string } = {}) {
    return request<PaginatedResponse<Offer>>(
      `/admin/offers${queryString({
        page: input.page,
        limit: input.limit,
        status: input.status,
        jobRequestId: input.jobRequestId,
        contractorId: input.contractorId,
      })}`,
    );
  },
  adminAuditLogs(input: { page?: number; limit?: number; action?: string; entityType?: string; entityId?: string } = {}) {
    return request<PaginatedResponse<AuditLog>>(
      `/admin/audit-logs${queryString({
        page: input.page,
        limit: input.limit,
        action: input.action?.trim(),
        entityType: input.entityType?.trim(),
        entityId: input.entityId?.trim(),
      })}`,
    );
  },
  adminReports(input: {
    page?: number;
    limit?: number;
    status?: ReportStatus;
    targetType?: ReportTargetType;
    reason?: ReportReason;
    reporterId?: string;
  } = {}) {
    return request<PaginatedResponse<Report>>(
      `/admin/reports${queryString({
        page: input.page,
        limit: input.limit,
        status: input.status,
        targetType: input.targetType,
        reason: input.reason,
        reporterId: input.reporterId,
      })}`,
    );
  },
  adminReport(reportId: string) {
    return request<Report>(`/admin/reports/${reportId}`);
  },
  updateAdminReportStatus(reportId: string, input: { status: ReportStatus; adminNote?: string }) {
    return request<Report>(`/admin/reports/${reportId}/status`, {
      method: 'PATCH',
      body: input,
    });
  },
  adminReportAction(
    reportId: string,
    action: 'suspend-user' | 'activate-user' | 'close-job' | 'remove-review' | 'hide-message',
  ) {
    return request<Report>(`/admin/reports/${reportId}/actions/${action}`, {
      method: 'POST',
    });
  },
  adminConversationMessages(id: string) {
    return request<ChatMessage[]>(`/admin/conversations/${id}/messages`);
  },
  portfolioImages() {
    return request<ContractorPortfolioImage[]>('/users/me/portfolio-images');
  },
  contractorServiceAreas() {
    return request<ContractorServiceAreasResponse>('/contractors/me/service-areas');
  },
  updateContractorServiceAreas(locations: string[]) {
    return request<ContractorServiceAreasResponse>('/contractors/me/service-areas', {
      method: 'PATCH',
      body: locations.map((locationKey) => ({
        locationKey,
        locationLabel: MALTA_SERVICE_LOCATIONS.find((location) => location.key === locationKey)?.label ?? locationKey,
      })),
    });
  },
  contractorServiceCategories() {
    return request<ContractorServiceCategoriesResponse>('/contractors/me/service-categories');
  },
  updateContractorServiceCategories(
    categories: Array<{ categoryKey: string; subcategoryKey?: string | null }>,
  ) {
    return request<ContractorServiceCategoriesResponse>('/contractors/me/service-categories', {
      method: 'PATCH',
      body: categories,
    });
  },
  async uploadPortfolioImages(images: UploadableFile[]) {
    const uploaded = await Promise.all(images.map((image) => uploadFileToS3('portfolio', image)));
    return request<ContractorPortfolioImage[]>('/users/me/portfolio-images', {
      method: 'POST',
      body: {
        imageKeys: uploaded.map((image) => image.key),
      },
    });
  },
  removePortfolioImage(imageId: string) {
    return request<{ success: true }>(`/users/me/portfolio-images/${imageId}`, {
      method: 'DELETE',
    });
  },
  contractorVerification() {
    return request<ContractorVerification>('/users/me/contractor-verification');
  },
  async uploadContractorVerification(document: UploadableFile) {
    const uploaded = await uploadFileToS3('verification', document);
    return request<ContractorVerification>('/users/me/contractor-verification', {
      method: 'POST',
      body: {
        documentKey: uploaded.key,
        documentMimeType: document.type,
      },
    });
  },
  adminContractorVerifications(input: { page?: number; limit?: number } = {}) {
    return request<PaginatedResponse<ContractorVerification>>(
      `/admin/contractor-verifications${queryString({ page: input.page, limit: input.limit })}`,
    );
  },
  adminContractorVerification(id: string) {
    return request<ContractorVerification>(`/admin/contractor-verifications/${id}`);
  },
  approveContractorVerification(id: string) {
    return request<ContractorVerification>(`/admin/contractor-verifications/${id}/approve`, {
      method: 'POST',
    });
  },
  rejectContractorVerification(id: string, adminNote?: string) {
    return request<ContractorVerification>(`/admin/contractor-verifications/${id}/reject`, {
      method: 'POST',
      body: { adminNote },
    });
  },
  async uploadJobImages(images: UploadableFile[], jobId: string) {
    const uploaded = await Promise.all(images.map((image) => uploadFileToS3('jobs', image, { jobId })));
    return {
      images: uploaded.map((image) => ({
        key: image.key,
        url: image.key,
        fileName: image.key.split('/').pop() ?? image.key,
        size: image.size,
        mimeType: image.contentType,
      })),
    };
  },
};

async function uploadFileToS3(folder: StorageFolder, file: UploadableFile, options: { jobId?: string } = {}) {
  const upload = await api.storageUploadUrl({
    folder,
    fileName: file.name,
    contentType: file.type,
    jobId: options.jobId,
  });
  const fileResponse = await fetch(file.uri);
  const blob = await fileResponse.blob();
  const response = await fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: blob,
  });

  if (!response.ok) {
    throw new ApiError(`Could not upload ${file.name} to storage.`, response.status);
  }

  return {
    key: upload.key,
    size: blob.size,
    contentType: file.type,
  };
}
