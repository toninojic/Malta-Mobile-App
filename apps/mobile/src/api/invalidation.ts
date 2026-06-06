import { QueryClient, QueryKey } from '@tanstack/react-query';
import { apiConfig } from '../config/apiConfig';
import { ChatMessage, JobRequest, Offer, PaginatedResponse } from '../types/domain';

type MarketplaceScope = {
  jobId?: string | null;
  offerId?: string | null;
  contactId?: string | null;
  conversationId?: string | null;
  contractorId?: string | null;
  reviewId?: string | null;
  includeAdmin?: boolean;
  includeTokens?: boolean;
  includeReviews?: boolean;
};

function compactKeys(keys: Array<QueryKey | null | undefined>) {
  return keys.filter((key): key is QueryKey => Boolean(key));
}

export async function invalidateQueryKeys(queryClient: QueryClient, keys: QueryKey[]) {
  const compactedKeys = compactKeys(keys);
  await Promise.all(compactedKeys.map((queryKey) => invalidateQueryKey(queryClient, queryKey)));
}

export async function invalidateQueryKey(queryClient: QueryClient, queryKey: QueryKey) {
  logInvalidation(queryKey);
  await queryClient.invalidateQueries({ queryKey });
}

export async function invalidateMarketplaceState(queryClient: QueryClient, scope: MarketplaceScope = {}) {
  const keys = compactKeys([
    ['activity', 'summary'],
    ['notifications'],
    ['jobs'],
    ['offers'],
    ['contacts'],
    ['messages', 'conversations'],
    scope.includeReviews ? ['reviews'] : null,
    scope.includeTokens ? ['tokens'] : null,
    scope.jobId ? ['jobs', scope.jobId] : null,
    scope.jobId ? ['offers', 'job', scope.jobId] : null,
    ['offers', 'mine'],
    scope.offerId ? ['offers', 'work-details', scope.offerId] : null,
    scope.offerId ? ['contacts', 'unlock-status', scope.offerId] : null,
    scope.contactId ? ['contacts', 'details', scope.contactId] : null,
    scope.contactId ? ['reviews', 'completion-status', scope.contactId] : null,
    scope.conversationId ? ['messages', 'conversation', scope.conversationId] : null,
    scope.contractorId ? ['contractors', scope.contractorId] : null,
    scope.contractorId ? ['contractors', scope.contractorId, 'reviews'] : null,
    scope.contractorId ? ['contractors', scope.contractorId, 'rating-summary'] : null,
    scope.reviewId ? ['reviews', 'details', scope.reviewId] : null,
    scope.includeAdmin ? ['admin', 'statistics'] : null,
    scope.includeAdmin ? ['admin', 'audit-logs'] : null,
    scope.includeAdmin ? ['admin', 'reviews'] : null,
    scope.includeAdmin ? ['admin', 'jobs'] : null,
    scope.includeAdmin ? ['admin', 'offers'] : null,
    scope.includeAdmin ? ['admin', 'contacts'] : null,
    scope.includeAdmin ? ['admin', 'messages', 'conversations'] : null,
    scope.includeAdmin ? ['admin', 'notifications'] : null,
  ]);

  await invalidateQueryKeys(queryClient, keys);
}

export function cacheJob(queryClient: QueryClient, job: JobRequest) {
  queryClient.setQueryData(['jobs', job.id], job);
  queryClient.setQueriesData<JobRequest[]>({ queryKey: ['jobs', 'mine'] }, (jobs) =>
    jobs?.map((currentJob) => (currentJob.id === job.id ? job : currentJob)),
  );
  queryClient.setQueriesData<PaginatedResponse<JobRequest>>({ queryKey: ['jobs', 'browse'] }, (page) =>
    page
      ? {
          ...page,
          data: page.data.map((currentJob) => (currentJob.id === job.id ? job : currentJob)),
        }
      : page,
  );
}

export function cacheOffer(queryClient: QueryClient, offer: Offer) {
  queryClient.setQueriesData<PaginatedResponse<Offer>>({ queryKey: ['offers', 'job', offer.jobRequestId] }, (page) =>
    page
      ? {
          ...page,
          data: page.data.map((currentOffer) => (currentOffer.id === offer.id ? offer : currentOffer)),
        }
      : page,
  );
  queryClient.setQueriesData<PaginatedResponse<Offer>>({ queryKey: ['offers', 'mine'] }, (page) =>
    page
      ? {
          ...page,
          data: page.data.map((currentOffer) => (currentOffer.id === offer.id ? offer : currentOffer)),
        }
      : page,
  );
}

export function appendMessage(queryClient: QueryClient, conversationId: string, message: ChatMessage) {
  queryClient.setQueryData<ChatMessage[]>(['messages', 'conversation', conversationId], (messages) => {
    const currentMessages = messages ?? [];
    if (currentMessages.some((currentMessage) => currentMessage.id === message.id)) {
      return currentMessages;
    }

    return [...currentMessages, message];
  });
}

function logInvalidation(queryKey: QueryKey) {
  if (!apiConfig.shouldLogDiagnostics) {
    return;
  }

  console.info(`Query invalidated: ${queryKeyLabel(queryKey)}`, { queryKey });
}

function queryKeyLabel(queryKey: QueryKey) {
  const [domain, section, id, detail] = queryKey;

  if (domain === 'activity' && section === 'summary') {
    return 'activity-summary';
  }

  if (domain === 'jobs' && typeof section === 'string' && section !== 'mine' && section !== 'browse') {
    return `job-details:${section}`;
  }

  if (domain === 'jobs' && section === 'mine') {
    return 'my-jobs';
  }

  if (domain === 'jobs' && section === 'browse') {
    return 'jobs-browse';
  }

  if (domain === 'offers' && section === 'job') {
    return `job-offers:${String(id)}`;
  }

  if (domain === 'offers' && section === 'mine') {
    return detail ? `my-offers:${String(detail)}` : 'my-offers';
  }

  if (domain === 'contacts' && section === 'details') {
    return `contact-details:${String(id)}`;
  }

  if (domain === 'contacts' && section === 'mine') {
    return 'unlocked-contacts';
  }

  if (domain === 'messages' && section === 'conversation') {
    return `conversation-thread:${String(id)}`;
  }

  if (domain === 'messages' && section === 'conversations') {
    return 'conversation-list';
  }

  if (domain === 'notifications' && section === 'unread-count') {
    return 'notifications-unread-count';
  }

  if (domain === 'notifications') {
    return 'notifications';
  }

  return queryKey.map((part) => String(part)).join('-');
}
