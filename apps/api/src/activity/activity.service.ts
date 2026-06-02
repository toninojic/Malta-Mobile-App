import { Injectable } from '@nestjs/common';
import { ContactUnlockStatus, JobCompletionStatus, JobStatus, OfferStatus, ReviewStatus, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(user: AuthenticatedUser) {
    if (user.role === UserRole.CONTRACTOR) {
      return this.contractorSummary(user.id);
    }

    if (user.role === UserRole.ADMIN) {
      return this.adminSummary();
    }

    return this.employerSummary(user.id);
  }

  private async contractorSummary(userId: string) {
    const [
      myOffersCount,
      selectedOffersCount,
      unlockedContactsCount,
      jobsInProgressCount,
      completedJobsCount,
      myReviewsCount,
    ] = await this.prisma.$transaction([
      this.prisma.offer.count({
        where: { contractorId: userId, deletedAt: null },
      }),
      this.prisma.offer.count({
        where: { contractorId: userId, status: OfferStatus.SELECTED, deletedAt: null },
      }),
      this.prisma.contactUnlock.count({
        where: { contractorId: userId, status: ContactUnlockStatus.UNLOCKED },
      }),
      this.prisma.contactUnlock.count({
        where: {
          contractorId: userId,
          status: ContactUnlockStatus.UNLOCKED,
          jobRequest: { status: JobStatus.IN_PROGRESS },
        },
      }),
      this.prisma.contactUnlock.count({
        where: {
          contractorId: userId,
          status: ContactUnlockStatus.UNLOCKED,
          jobRequest: { status: JobStatus.COMPLETED },
        },
      }),
      this.prisma.review.count({
        where: { contractorId: userId, status: ReviewStatus.ACTIVE },
      }),
    ]);

    return {
      role: UserRole.CONTRACTOR,
      myOffersCount,
      selectedOffersCount,
      unlockedContactsCount,
      jobsInProgressCount,
      completedJobsCount,
      myReviewsCount,
    };
  }

  private async employerSummary(userId: string) {
    const [
      myJobsCount,
      offersReceivedCount,
      selectedOffersCount,
      unlockedContactsCount,
      jobsInProgressCount,
      jobsWaitingConfirmationCount,
      reviewsToLeaveCount,
      alertsCount,
    ] = await this.prisma.$transaction([
      this.prisma.jobRequest.count({
        where: { employerId: userId },
      }),
      this.prisma.offer.count({
        where: {
          deletedAt: null,
          jobRequest: { employerId: userId },
        },
      }),
      this.prisma.offer.count({
        where: {
          status: OfferStatus.SELECTED,
          deletedAt: null,
          jobRequest: { employerId: userId },
        },
      }),
      this.prisma.contactUnlock.count({
        where: { employerId: userId, status: ContactUnlockStatus.UNLOCKED },
      }),
      this.prisma.jobRequest.count({
        where: { employerId: userId, status: JobStatus.IN_PROGRESS },
      }),
      this.prisma.jobCompletion.count({
        where: { employerId: userId, status: JobCompletionStatus.PENDING_EMPLOYER_CONFIRMATION },
      }),
      this.prisma.contactUnlock.count({
        where: {
          employerId: userId,
          status: ContactUnlockStatus.UNLOCKED,
          jobRequest: { status: JobStatus.COMPLETED },
          review: null,
        },
      }),
      this.prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      role: UserRole.EMPLOYER,
      myJobsCount,
      offersReceivedCount,
      selectedOffersCount,
      unlockedContactsCount,
      jobsInProgressCount,
      jobsWaitingConfirmationCount,
      reviewsToLeaveCount,
      alertsCount,
    };
  }

  private async adminSummary() {
    const [
      myJobsCount,
      offersReceivedCount,
      selectedOffersCount,
      unlockedContactsCount,
      jobsInProgressCount,
      completedJobsCount,
    ] = await this.prisma.$transaction([
      this.prisma.jobRequest.count(),
      this.prisma.offer.count({ where: { deletedAt: null } }),
      this.prisma.offer.count({ where: { status: OfferStatus.SELECTED, deletedAt: null } }),
      this.prisma.contactUnlock.count({ where: { status: ContactUnlockStatus.UNLOCKED } }),
      this.prisma.jobRequest.count({ where: { status: JobStatus.IN_PROGRESS } }),
      this.prisma.jobRequest.count({ where: { status: JobStatus.COMPLETED } }),
    ]);

    return {
      role: UserRole.ADMIN,
      myJobsCount,
      offersReceivedCount,
      selectedOffersCount,
      unlockedContactsCount,
      jobsInProgressCount,
      completedJobsCount,
      jobsWaitingConfirmationCount: 0,
      reviewsToLeaveCount: 0,
      alertsCount: 0,
    };
  }
}
