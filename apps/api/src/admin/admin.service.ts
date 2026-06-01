import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  JobStatus,
  NotificationType,
  OfferStatus,
  PaymentStatus,
  Prisma,
  RefundStatus,
  ReviewStatus,
  TokenTransactionType,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { paginationMeta } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminJobsQueryDto } from './dto/admin-jobs-query.dto';
import { AdminOffersQueryDto } from './dto/admin-offers-query.dto';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';

const adminUserInclude = {
  profile: true,
  tokenBalance: true,
  _count: {
    select: {
      jobRequests: true,
      offers: true,
      notifications: true,
    },
  },
};

const adminJobInclude = {
  images: {
    orderBy: { sortOrder: 'asc' as const },
  },
  employer: {
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      profile: true,
    },
  },
  offers: {
    include: {
      contractor: {
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          profile: true,
        },
      },
      contactUnlock: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
  contactUnlocks: true,
  completions: true,
  reviews: true,
};

const adminOfferInclude = {
  contractor: {
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      profile: true,
    },
  },
  jobRequest: {
    include: {
      images: {
        orderBy: { sortOrder: 'asc' as const },
      },
      employer: {
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          profile: true,
        },
      },
    },
  },
  contactUnlock: true,
};

type AdminUser = Prisma.UserGetPayload<{ include: typeof adminUserInclude }>;
type AdminJob = Prisma.JobRequestGetPayload<{ include: typeof adminJobInclude }>;
type AdminOffer = Prisma.OfferGetPayload<{ include: typeof adminOfferInclude }>;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async statistics() {
    const [
      totalUsers,
      employers,
      contractors,
      admins,
      activeUsers,
      suspendedUsers,
      totalJobs,
      activeJobs,
      inProgressJobs,
      completedJobs,
      closedJobs,
      expiredJobs,
      totalOffers,
      pendingOffers,
      selectedOffers,
      withdrawnOffers,
      rejectedOffers,
      completedOffers,
      purchaseSum,
      spendSum,
      refundSum,
      tokenBalanceSum,
      purchaseTransactions,
      totalReviews,
      activeReviews,
      removedReviews,
      reviewAverage,
      conversations,
      messages,
      pendingRefunds,
      approvedRefunds,
      rejectedRefunds,
      totalPayments,
      paidPayments,
      failedPayments,
      pendingPayments,
      paidPaymentRevenue,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: UserRole.EMPLOYER } }),
      this.prisma.user.count({ where: { role: UserRole.CONTRACTOR } }),
      this.prisma.user.count({ where: { role: UserRole.ADMIN } }),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
      this.prisma.jobRequest.count(),
      this.prisma.jobRequest.count({ where: { status: JobStatus.ACTIVE } }),
      this.prisma.jobRequest.count({ where: { status: JobStatus.IN_PROGRESS } }),
      this.prisma.jobRequest.count({ where: { status: JobStatus.COMPLETED } }),
      this.prisma.jobRequest.count({ where: { status: JobStatus.CLOSED } }),
      this.prisma.jobRequest.count({ where: { status: JobStatus.EXPIRED } }),
      this.prisma.offer.count(),
      this.prisma.offer.count({ where: { status: OfferStatus.PENDING } }),
      this.prisma.offer.count({ where: { status: OfferStatus.SELECTED } }),
      this.prisma.offer.count({ where: { status: OfferStatus.WITHDRAWN } }),
      this.prisma.offer.count({ where: { status: OfferStatus.REJECTED } }),
      this.prisma.offer.count({ where: { status: OfferStatus.COMPLETED } }),
      this.prisma.tokenTransaction.aggregate({
        where: { type: TokenTransactionType.PURCHASE },
        _sum: { amount: true },
      }),
      this.prisma.tokenTransaction.aggregate({
        where: { type: TokenTransactionType.SPEND },
        _sum: { amount: true },
      }),
      this.prisma.tokenTransaction.aggregate({
        where: { type: TokenTransactionType.REFUND },
        _sum: { amount: true },
      }),
      this.prisma.userTokenBalance.aggregate({ _sum: { balance: true } }),
      this.prisma.tokenTransaction.findMany({
        where: { type: TokenTransactionType.PURCHASE },
        include: { package: true },
      }),
      this.prisma.review.count(),
      this.prisma.review.count({ where: { status: ReviewStatus.ACTIVE, removedAt: null } }),
      this.prisma.review.count({ where: { status: ReviewStatus.REMOVED } }),
      this.prisma.review.aggregate({
        where: { status: ReviewStatus.ACTIVE, removedAt: null },
        _avg: { rating: true },
      }),
      this.prisma.conversation.count(),
      this.prisma.message.count({ where: { deletedAt: null } }),
      this.prisma.refundRequest.count({ where: { status: RefundStatus.PENDING } }),
      this.prisma.refundRequest.count({ where: { status: RefundStatus.APPROVED } }),
      this.prisma.refundRequest.count({ where: { status: RefundStatus.REJECTED } }),
      this.prisma.payment.count(),
      this.prisma.payment.count({ where: { status: PaymentStatus.PAID } }),
      this.prisma.payment.count({ where: { status: PaymentStatus.FAILED } }),
      this.prisma.payment.count({ where: { status: PaymentStatus.PENDING } }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.PAID },
        _sum: { amount: true },
      }),
    ]);

    const tokenPurchaseRevenue = purchaseTransactions.reduce(
      (sum, transaction) => sum + (transaction.package ? Number(transaction.package.price) : 0),
      0,
    );

    return {
      users: {
        total: totalUsers,
        employers,
        contractors,
        admins,
        active: activeUsers,
        suspended: suspendedUsers,
      },
      jobs: {
        total: totalJobs,
        active: activeJobs,
        inProgress: inProgressJobs,
        completed: completedJobs,
        closed: closedJobs,
        expired: expiredJobs,
      },
      offers: {
        total: totalOffers,
        pending: pendingOffers,
        selected: selectedOffers,
        withdrawn: withdrawnOffers,
        rejected: rejectedOffers,
        completed: completedOffers,
      },
      tokens: {
        totalPurchased: purchaseSum._sum.amount ?? 0,
        totalSpent: Math.abs(spendSum._sum.amount ?? 0),
        totalRefunded: Math.abs(refundSum._sum.amount ?? 0),
        activeTokenBalance: tokenBalanceSum._sum.balance ?? 0,
        purchaseRevenue: tokenPurchaseRevenue,
        mockRevenue: tokenPurchaseRevenue,
      },
      reviews: {
        total: totalReviews,
        active: activeReviews,
        removed: removedReviews,
        averageRating: Number((reviewAverage._avg.rating ?? 0).toFixed(2)),
      },
      conversations: {
        total: conversations,
        messages,
      },
      refunds: {
        pending: pendingRefunds,
        approved: approvedRefunds,
        rejected: rejectedRefunds,
      },
      payments: {
        total: totalPayments,
        paid: paidPayments,
        failed: failedPayments,
        pending: pendingPayments,
        testRevenue: Number(paidPaymentRevenue._sum.amount ?? 0),
      },
    };
  }

  async users(query: AdminUsersQueryDto) {
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { profile: { displayName: { contains: query.search, mode: 'insensitive' } } },
              { profile: { phone: { contains: query.search, mode: 'insensitive' } } },
              { profile: { companyName: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: adminUserInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((user) => this.toAdminUser(user)),
      pagination: paginationMeta(query.page, query.limit, total),
    };
  }

  async user(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: adminUserInclude,
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return this.toAdminUser(user);
  }

  async suspendUser(admin: AuthenticatedUser, userId: string) {
    if (admin.id === userId) {
      throw new BadRequestException('Admins cannot suspend themselves.');
    }

    return this.updateUserStatus(admin, userId, UserStatus.SUSPENDED, 'USER_SUSPENDED');
  }

  async activateUser(admin: AuthenticatedUser, userId: string) {
    return this.updateUserStatus(admin, userId, UserStatus.ACTIVE, 'USER_ACTIVATED');
  }

  async jobs(query: AdminJobsQueryDto) {
    const where: Prisma.JobRequestWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: { equals: query.category, mode: 'insensitive' } } : {}),
      ...(query.location ? { location: { contains: query.location, mode: 'insensitive' } } : {}),
      ...(query.employerId ? { employerId: query.employerId } : {}),
    };

    const [jobs, total] = await this.prisma.$transaction([
      this.prisma.jobRequest.findMany({
        where,
        include: adminJobInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.jobRequest.count({ where }),
    ]);

    return {
      data: jobs.map((job) => this.toAdminJob(job)),
      pagination: paginationMeta(query.page, query.limit, total),
    };
  }

  async job(jobId: string) {
    const job = await this.prisma.jobRequest.findUnique({
      where: { id: jobId },
      include: adminJobInclude,
    });

    if (!job) {
      throw new NotFoundException('Job request not found.');
    }

    return this.toAdminJob(job);
  }

  async closeJob(admin: AuthenticatedUser, jobId: string) {
    const job = await this.prisma.jobRequest.findUnique({
      where: { id: jobId },
      include: adminJobInclude,
    });

    if (!job) {
      throw new NotFoundException('Job request not found.');
    }

    if (job.status === JobStatus.COMPLETED) {
      throw new BadRequestException('Completed jobs cannot be closed by moderation.');
    }

    if (job.status === JobStatus.CLOSED) {
      throw new ConflictException('Job request is already closed.');
    }

    const closed = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.jobRequest.update({
        where: { id: job.id },
        data: { status: JobStatus.CLOSED },
        include: adminJobInclude,
      });

      await this.auditLogsService.create(
        {
          adminId: admin.id,
          action: 'JOB_CLOSED_BY_ADMIN',
          entityType: 'JobRequest',
          entityId: job.id,
          metadata: {
            previousStatus: job.status,
            newStatus: JobStatus.CLOSED,
            employerId: job.employerId,
          },
        },
        tx,
      );

      return updated;
    });

    return this.toAdminJob(closed);
  }

  async offers(query: AdminOffersQueryDto) {
    const where: Prisma.OfferWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.jobRequestId ? { jobRequestId: query.jobRequestId } : {}),
      ...(query.contractorId ? { contractorId: query.contractorId } : {}),
    };

    const [offers, total] = await this.prisma.$transaction([
      this.prisma.offer.findMany({
        where,
        include: adminOfferInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.offer.count({ where }),
    ]);

    return {
      data: offers.map((offer) => this.toAdminOffer(offer)),
      pagination: paginationMeta(query.page, query.limit, total),
    };
  }

  async offer(offerId: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: adminOfferInclude,
    });

    if (!offer) {
      throw new NotFoundException('Offer not found.');
    }

    return this.toAdminOffer(offer);
  }

  private async updateUserStatus(
    admin: AuthenticatedUser,
    userId: string,
    status: UserStatus,
    action: 'USER_SUSPENDED' | 'USER_ACTIVATED',
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: adminUserInclude,
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.status === status) {
      return this.toAdminUser(user);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.user.update({
        where: { id: userId },
        data: { status },
        include: adminUserInclude,
      });

      await this.auditLogsService.create(
        {
          adminId: admin.id,
          action,
          entityType: 'User',
          entityId: user.id,
          metadata: {
            previousStatus: user.status,
            newStatus: status,
            role: user.role,
          },
        },
        tx,
      );

      await this.notificationsService.create(
        {
          userId,
          type: status === UserStatus.SUSPENDED ? NotificationType.ACCOUNT_SUSPENDED : NotificationType.ACCOUNT_ACTIVATED,
          title: status === UserStatus.SUSPENDED ? 'Account suspended' : 'Account activated',
          body:
            status === UserStatus.SUSPENDED
              ? 'Your account has been suspended by an admin.'
              : 'Your account has been activated by an admin.',
          data: {
            userId,
            previousStatus: user.status,
            newStatus: status,
          },
        },
        tx,
      );

      return next;
    });

    return this.toAdminUser(updated);
  }

  private toAdminUser(user: AdminUser) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      profile: user.profile,
      tokenBalance: user.tokenBalance,
      counts: user._count,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private toAdminJob(job: AdminJob) {
    return {
      id: job.id,
      employerId: job.employerId,
      title: job.title,
      description: job.description,
      category: job.category,
      subcategory: job.subcategory,
      location: job.location,
      status: job.status,
      expiresAt: job.expiresAt,
      contractorMarkedCompletedAt: job.contractorMarkedCompletedAt,
      employerConfirmedCompletedAt: job.employerConfirmedCompletedAt,
      images: job.images,
      employer: job.employer,
      offers: job.offers.map((offer) => ({
        id: offer.id,
        contractorId: offer.contractorId,
        estimatedPrice: offer.estimatedPrice.toString(),
        estimatedCompletionDays: offer.estimatedCompletionDays,
        message: offer.message,
        status: offer.status,
        selectedByEmployer: offer.selectedByEmployer,
        contactUnlock: offer.contactUnlock,
        contractor: offer.contractor,
        createdAt: offer.createdAt,
        updatedAt: offer.updatedAt,
      })),
      contactUnlocks: job.contactUnlocks,
      completions: job.completions,
      reviews: job.reviews,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  private toAdminOffer(offer: AdminOffer) {
    return {
      id: offer.id,
      jobRequestId: offer.jobRequestId,
      contractorId: offer.contractorId,
      estimatedPrice: offer.estimatedPrice.toString(),
      estimatedCompletionDays: offer.estimatedCompletionDays,
      message: offer.message,
      status: offer.status,
      selectedByEmployer: offer.selectedByEmployer,
      deletedAt: offer.deletedAt,
      contactUnlock: offer.contactUnlock,
      contractor: offer.contractor,
      jobRequest: offer.jobRequest,
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
    };
  }
}
