import { JobCompletionStatus, Offer, OfferStatus } from '../types/domain';

export type OfferWorkFilter =
  | 'ALL'
  | 'PENDING'
  | 'SELECTED'
  | 'UNLOCKED'
  | 'IN_PROGRESS'
  | 'PENDING_CONFIRMATION'
  | 'COMPLETED'
  | 'WITHDRAWN'
  | 'REJECTED';

export const OFFER_WORK_FILTERS: Array<{ value: OfferWorkFilter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SELECTED', label: 'Selected' },
  { value: 'UNLOCKED', label: 'Unlocked' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'PENDING_CONFIRMATION', label: 'Pending Confirmation' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
  { value: 'REJECTED', label: 'Rejected' },
];

export function offerMatchesFilter(offer: Offer, filter: OfferWorkFilter) {
  const completed = isCompletedOffer(offer);

  if (filter === 'ALL') {
    return true;
  }

  if (filter === 'COMPLETED') {
    return completed;
  }

  if (filter === 'UNLOCKED') {
    return offer.unlockStatus === 'UNLOCKED' && !completed;
  }

  if (filter === 'IN_PROGRESS') {
    return offer.jobRequest?.status === 'IN_PROGRESS' && !offer.completionStatus && !completed;
  }

  if (filter === 'PENDING_CONFIRMATION') {
    return offer.completionStatus === 'PENDING_EMPLOYER_CONFIRMATION' && !completed;
  }

  return offer.status === filter;
}

export function isActiveOffer(offer: Offer) {
  if (offer.status === 'WITHDRAWN' || offer.status === 'REJECTED' || isCompletedOffer(offer)) {
    return false;
  }

  return (
    offer.status === 'PENDING' ||
    offer.status === 'SELECTED' ||
    offer.unlockStatus === 'UNLOCKED' ||
    offer.jobRequest?.status === 'IN_PROGRESS' ||
    offer.completionStatus === 'PENDING_EMPLOYER_CONFIRMATION'
  );
}

export function isCompletedOffer(offer: Offer) {
  return offer.status === 'COMPLETED' || offer.completionStatus === 'CONFIRMED' || offer.jobRequest?.status === 'COMPLETED';
}

export function primaryOfferActionLabel(offer: Offer) {
  if (offer.status === 'PENDING') {
    return 'Edit or withdraw offer';
  }

  if (offer.status === 'SELECTED' && offer.unlockStatus !== 'UNLOCKED') {
    return 'Unlock Contact - 1 token';
  }

  if (offer.unlockStatus === 'UNLOCKED' && !offer.completionStatus) {
    return 'Open chat or mark completed';
  }

  if (offer.completionStatus === 'PENDING_EMPLOYER_CONFIRMATION') {
    return 'Waiting for employer confirmation';
  }

  if (offer.status === 'COMPLETED' || offer.completionStatus === 'CONFIRMED') {
    return 'View completed work';
  }

  return 'View details';
}

export function completionStatusLabel(status?: JobCompletionStatus | null) {
  return status ?? 'NOT_STARTED';
}

export function statusRank(status: OfferStatus) {
  return ['SELECTED', 'PENDING', 'COMPLETED', 'WITHDRAWN', 'REJECTED'].indexOf(status);
}
