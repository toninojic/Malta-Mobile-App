import {
  AuthResponse,
  AuthUser,
  ChatMessage,
  CompletionStatusResponse,
  ContactUnlock,
  ContractorRatingSummary,
  Conversation,
  InAppNotification,
  JobCompletion,
  JobBrowseFilters,
  JobFormValues,
  JobRequest,
  Offer,
  OfferFormValues,
  OfferStatus,
  PaginatedResponse,
  RefundRequest,
  RefundStatus,
  Review,
  TokenBalance,
  TokenPackage,
  TokenTransaction,
  UnlockResult,
  UnlockStatusResponse,
  UserProfile,
  UserRole,
} from '../types/domain';
import { getAccessToken, getRefreshToken, useAuthStore } from '../store/auth.store';
import { apiConfig } from '../config/apiConfig';

const API_URL = apiConfig.baseUrl;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  authenticated?: boolean;
  retryOnUnauthorized?: boolean;
  debugLabel?: 'login';
};

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
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

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
      body: options.body ? JSON.stringify(options.body) : undefined,
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
  }) {
    return request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: input,
      authenticated: false,
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
  jobsMine() {
    return request<JobRequest[]>('/jobs/mine');
  },
  browseJobs(filters: JobBrowseFilters = {}) {
    return request<PaginatedResponse<JobRequest>>(
      `/jobs${queryString({
        category: filters.category?.trim(),
        subcategory: filters.subcategory?.trim(),
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
    return request<JobRequest>('/jobs', {
      method: 'POST',
      body: input,
    });
  },
  updateJob(id: string, input: JobFormValues) {
    return request<JobRequest>(`/jobs/${id}`, {
      method: 'PATCH',
      body: input,
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
    return request<Offer>(`/jobs/${jobId}/offers`, {
      method: 'POST',
      body: input,
    });
  },
  updateOffer(offerId: string, input: OfferFormValues) {
    return request<Offer>(`/offers/${offerId}`, {
      method: 'PATCH',
      body: input,
    });
  },
  selectOffer(offerId: string) {
    return request<Offer>(`/offers/${offerId}/select`, {
      method: 'POST',
    });
  },
  withdrawOffer(offerId: string) {
    return request<Offer>(`/offers/${offerId}/withdraw`, {
      method: 'POST',
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
  mockPurchase(tokenPackageId: string) {
    return request<{ balance: TokenBalance; transaction: TokenTransaction }>('/tokens/mock-purchase', {
      method: 'POST',
      body: { tokenPackageId },
    });
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
    return request<UnlockResult>(`/offers/${offerId}/unlock`, {
      method: 'POST',
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
    });
  },
  confirmCompletion(contactId: string) {
    return request<JobCompletion>(`/contacts/${contactId}/confirm-completion`, {
      method: 'POST',
    });
  },
  completionStatus(contactId: string) {
    return request<CompletionStatusResponse>(`/contacts/${contactId}/completion-status`);
  },
  createReview(contactId: string, input: { rating: number; comment?: string }) {
    return request<Review>(`/contacts/${contactId}/review`, {
      method: 'POST',
      body: input,
    });
  },
  review(reviewId: string) {
    return request<Review>(`/reviews/${reviewId}`);
  },
  contractorReviews(contractorId: string, input: { page?: number; limit?: number } = {}) {
    return request<PaginatedResponse<Review>>(
      `/contractors/${contractorId}/reviews${queryString({ page: input.page, limit: input.limit })}`,
    );
  },
  contractorRatingSummary(contractorId: string) {
    return request<ContractorRatingSummary>(`/contractors/${contractorId}/rating-summary`);
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
  conversationMessages(id: string) {
    return request<ChatMessage[]>(`/conversations/${id}/messages`);
  },
  sendMessage(id: string, content: string) {
    return request<{ conversation: Conversation; message: ChatMessage }>(`/conversations/${id}/messages`, {
      method: 'POST',
      body: { content },
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
  adminNotifications(input: { page?: number; limit?: number } = {}) {
    return request<PaginatedResponse<InAppNotification>>(
      `/admin/notifications${queryString({ page: input.page, limit: input.limit })}`,
    );
  },
};
