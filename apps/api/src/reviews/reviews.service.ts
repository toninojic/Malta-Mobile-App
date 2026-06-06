import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContactUnlockStatus,
  JobCompletionStatus,
  JobStatus,
  NotificationType,
  OfferStatus,
  Prisma,
  Review,
  ReviewStatus,
  UserRole,
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PaginatedResponse, PaginationQueryDto, paginationMeta } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';

const userSelect = {
  id: true,
  email: true,
  status: true,
  profile: true,
};

const completionInclude = {
  jobRequest: {
    include: {
      images: {
        orderBy: { sortOrder: 'asc' as const },
      },
    },
  },
  offer: true,
  contactUnlock: true,
  employer: {
    select: userSelect,
  },
  contractor: {
    select: userSelect,
  },
};

const reviewInclude = {
  jobRequest: {
    include: {
      images: {
        orderBy: { sortOrder: 'asc' as const },
      },
    },
  },
  offer: true,
  contactUnlock: true,
  employer: {
    select: userSelect,
  },
  contractor: {
    select: userSelect,
  },
  removedByAdmin: {
    select: {
      id: true,
      email: true,
      profile: true,
    },
  },
};

type CompletionWithRelations = Prisma.JobCompletionGetPayload<{ include: typeof completionInclude }>;
type ReviewWithRelations = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async markComplete(user: AuthenticatedUser, contactId: string) {
    if (user.role !== UserRole.CONTRACTOR) {
      throw new ForbiddenException('Only contractors can mark jobs as completed.');
    }

    const contact = await this.getUnlockedContact(contactId);
    if (contact.contractorId !== user.id) {
      throw new ForbiddenException('You can complete only your own unlocked jobs.');
    }

    if (contact.jobRequest.status === JobStatus.CLOSED) {
      throw new BadRequestException('Closed job requests cannot be completed.');
    }

    if (contact.jobRequest.status === JobStatus.COMPLETED) {
      throw new BadRequestException('Completed job requests cannot be completed again.');
    }

    if (contact.offer.status !== OfferStatus.SELECTED) {
      throw new BadRequestException('Only selected offers can be marked completed.');
    }

    const existing = await this.prisma.jobCompletion.findUnique({
      where: { contactUnlockId: contact.id },
      include: completionInclude,
    });

    if (existing?.status === JobCompletionStatus.CONFIRMED) {
      throw new BadRequestException('This job completion has already been confirmed.');
    }

    if (existing?.status === JobCompletionStatus.PENDING_EMPLOYER_CONFIRMATION) {
      return this.toCompletion(existing);
    }

    const now = new Date();
    const completion = await this.prisma.$transaction(async (tx) => {
      const created = await tx.jobCompletion.create({
        data: {
          jobRequestId: contact.jobRequestId,
          offerId: contact.offerId,
          contactUnlockId: contact.id,
          employerId: contact.employerId,
          contractorId: contact.contractorId,
          status: JobCompletionStatus.PENDING_EMPLOYER_CONFIRMATION,
          contractorMarkedAt: now,
        },
        include: completionInclude,
      });

      await tx.jobRequest.update({
        where: { id: contact.jobRequestId },
        data: {
          status: JobStatus.IN_PROGRESS,
          contractorMarkedCompletedAt: now,
        },
      });

      await this.notificationsService.create(
        {
          userId: contact.employerId,
          type: NotificationType.JOB_COMPLETED,
          title: 'Completion confirmation needed',
          body: 'Contractor marked your job as completed. Please confirm.',
          data: {
            contactId: contact.id,
            jobRequestId: contact.jobRequestId,
            offerId: contact.offerId,
            completionId: created.id,
          },
        },
        tx,
      );

      return created;
    });

    return this.toCompletion(completion);
  }

  async confirmCompletion(user: AuthenticatedUser, contactId: string) {
    if (user.role !== UserRole.EMPLOYER) {
      throw new ForbiddenException('Only employers can confirm job completion.');
    }

    const contact = await this.getUnlockedContact(contactId);
    if (contact.employerId !== user.id) {
      throw new ForbiddenException('You can confirm completion only for your own job request.');
    }

    const completion = await this.prisma.jobCompletion.findUnique({
      where: { contactUnlockId: contact.id },
      include: completionInclude,
    });

    if (!completion) {
      throw new BadRequestException('Contractor must mark the job completed before employer confirmation.');
    }

    if (completion.status === JobCompletionStatus.CONFIRMED) {
      return this.toCompletion(completion);
    }

    if (completion.status !== JobCompletionStatus.PENDING_EMPLOYER_CONFIRMATION) {
      throw new BadRequestException(`Cannot confirm a ${completion.status.toLowerCase()} completion.`);
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const confirmed = await tx.jobCompletion.update({
        where: { id: completion.id },
        data: {
          status: JobCompletionStatus.CONFIRMED,
          employerConfirmedAt: now,
        },
        include: completionInclude,
      });

      await tx.jobRequest.update({
        where: { id: contact.jobRequestId },
        data: {
          status: JobStatus.COMPLETED,
          employerConfirmedCompletedAt: now,
        },
      });

      await tx.offer.update({
        where: { id: contact.offerId },
        data: {
          status: OfferStatus.COMPLETED,
          selectedByEmployer: true,
        },
      });

      await this.notificationsService.create(
        {
          userId: contact.contractorId,
          type: NotificationType.JOB_COMPLETED,
          title: 'Job completion confirmed',
          body: 'Employer confirmed job completion.',
          data: {
            contactId: contact.id,
            jobRequestId: contact.jobRequestId,
            offerId: contact.offerId,
            completionId: confirmed.id,
          },
        },
        tx,
      );

      return confirmed;
    });

    return this.toCompletion(updated);
  }

  async getCompletionStatus(user: AuthenticatedUser, contactId: string) {
    const contact = await this.getUnlockedContact(contactId);
    this.assertCanViewContact(user, contact);

    const completion = await this.prisma.jobCompletion.findUnique({
      where: { contactUnlockId: contact.id },
      include: completionInclude,
    });
    const review = await this.prisma.review.findUnique({
      where: { contactUnlockId: contact.id },
      include: reviewInclude,
    });

    return {
      contactId: contact.id,
      jobRequestId: contact.jobRequestId,
      offerId: contact.offerId,
      status: completion?.status ?? null,
      canReview: completion?.status === JobCompletionStatus.CONFIRMED && contact.jobRequest.status === JobStatus.COMPLETED,
      completion: completion ? this.toCompletion(completion) : null,
      review: review ? this.toReview(review) : null,
    };
  }

  async createReview(user: AuthenticatedUser, contactId: string, dto: CreateReviewDto) {
    if (user.role !== UserRole.EMPLOYER) {
      throw new ForbiddenException('Only employers can create reviews.');
    }

    const contact = await this.getUnlockedContact(contactId);
    if (contact.employerId !== user.id) {
      throw new ForbiddenException('You can review only contractors on your own job requests.');
    }

    const completion = await this.prisma.jobCompletion.findUnique({
      where: { contactUnlockId: contact.id },
      include: completionInclude,
    });

    if (!completion || completion.status !== JobCompletionStatus.CONFIRMED || contact.jobRequest.status !== JobStatus.COMPLETED) {
      throw new BadRequestException('Review becomes available only after confirmed job completion.');
    }

    const existingReview = await this.prisma.review.findFirst({
      where: {
        OR: [
          { contactUnlockId: contact.id },
          { offerId: contact.offerId },
          { jobRequestId: contact.jobRequestId, contractorId: contact.contractorId },
        ],
      },
    });

    if (existingReview) {
      throw new ConflictException('This completed job has already been reviewed.');
    }

    const comment = this.sanitizeOptional(dto.comment);
    const review = await this.prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          jobRequestId: contact.jobRequestId,
          offerId: contact.offerId,
          contactUnlockId: contact.id,
          employerId: contact.employerId,
          contractorId: contact.contractorId,
          rating: dto.rating,
          comment,
          status: ReviewStatus.ACTIVE,
        },
        include: reviewInclude,
      });

      await this.recalculateRatingSummary(tx, contact.contractorId);

      await this.notificationsService.create(
        {
          userId: contact.contractorId,
          type: NotificationType.REVIEW_RECEIVED,
          title: 'New review received',
          body: `${contact.employer.profile?.displayName ?? contact.employer.email} left a ${dto.rating}-star review for ${contact.jobRequest.title}.`,
          data: {
            reviewId: created.id,
            contactId: contact.id,
            jobRequestId: contact.jobRequestId,
            offerId: contact.offerId,
          },
        },
        tx,
      );

      return created;
    });

    return this.toReview(review);
  }

  async findContractorReviews(
    contractorId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<ReturnType<ReviewsService['toReview']>>> {
    await this.assertContractorExists(contractorId);

    const where: Prisma.ReviewWhereInput = {
      contractorId,
      status: ReviewStatus.ACTIVE,
      removedAt: null,
    };

    const [reviews, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        include: reviewInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      data: reviews.map((review) => this.toReview(review)),
      pagination: paginationMeta(query.page, query.limit, total),
    };
  }

  async getRatingSummary(contractorId: string) {
    await this.assertContractorExists(contractorId);
    const summary = await this.prisma.contractorRatingSummary.findUnique({
      where: { contractorId },
    });

    return this.toRatingSummary(
      summary ?? {
        id: null,
        contractorId,
        averageRating: new Prisma.Decimal(0),
        totalReviews: 0,
        createdAt: null,
        updatedAt: null,
      },
    );
  }

  async replyToReview(user: AuthenticatedUser, reviewId: string, dto: ReplyReviewDto) {
    if (user.role !== UserRole.CONTRACTOR) {
      throw new ForbiddenException('Only contractors can reply to reviews.');
    }

    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: reviewInclude,
    });

    if (!review || review.status === ReviewStatus.REMOVED || review.removedAt) {
      throw new NotFoundException('Review not found.');
    }

    if (review.contractorId !== user.id) {
      throw new ForbiddenException('You can reply only to reviews on your own contractor profile.');
    }

    if (review.contractorReply) {
      throw new ConflictException('Contractor has already replied to this review.');
    }

    const contractorReply = this.sanitizeRequired(dto.contractorReply, 'Contractor reply cannot be empty.');
    const updated = await this.prisma.$transaction(async (tx) => {
      const replied = await tx.review.update({
        where: { id: review.id },
        data: {
          contractorReply,
          contractorReplyAt: new Date(),
        },
        include: reviewInclude,
      });

      await this.notificationsService.create(
        {
          userId: review.employerId,
          type: NotificationType.REVIEW_REPLIED,
          title: 'Contractor replied to your review',
          body: `${review.contractor.profile?.displayName ?? review.contractor.email} replied to your review for ${review.jobRequest.title}.`,
          data: {
            reviewId: review.id,
            contactId: review.contactUnlockId,
            jobRequestId: review.jobRequestId,
            offerId: review.offerId,
          },
        },
        tx,
      );

      return replied;
    });

    return this.toReview(updated);
  }

  async findReviewForUser(user: AuthenticatedUser, reviewId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: reviewInclude,
    });

    if (!review) {
      throw new NotFoundException('Review not found.');
    }

    if (user.role === UserRole.ADMIN || review.employerId === user.id || review.contractorId === user.id) {
      return this.toReview(review);
    }

    if (review.status === ReviewStatus.ACTIVE && !review.removedAt) {
      return this.toReview(review);
    }

    throw new ForbiddenException('You cannot access this review.');
  }

  async findAdminReviews(query: PaginationQueryDto): Promise<PaginatedResponse<ReturnType<ReviewsService['toReview']>>> {
    const [reviews, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        include: reviewInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.review.count(),
    ]);

    return {
      data: reviews.map((review) => this.toReview(review)),
      pagination: paginationMeta(query.page, query.limit, total),
    };
  }

  async findAdminReview(reviewId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: reviewInclude,
    });

    if (!review) {
      throw new NotFoundException('Review not found.');
    }

    return this.toReview(review);
  }

  async removeReview(user: AuthenticatedUser, reviewId: string) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can remove reviews.');
    }

    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: reviewInclude,
    });

    if (!review) {
      throw new NotFoundException('Review not found.');
    }

    if (review.status === ReviewStatus.REMOVED || review.removedAt) {
      throw new ConflictException('Review has already been removed.');
    }

    const removed = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.review.update({
        where: { id: review.id },
        data: {
          status: ReviewStatus.REMOVED,
          removedAt: new Date(),
          removedByAdminId: user.id,
        },
        include: reviewInclude,
      });

      await this.recalculateRatingSummary(tx, review.contractorId);

      await this.notificationsService.create(
        {
          userId: review.contractorId,
          type: NotificationType.REVIEW_REMOVED,
          title: 'Review removed',
          body: `An admin removed a review from ${review.employer.profile?.displayName ?? review.employer.email}.`,
          data: {
            reviewId: review.id,
            contactId: review.contactUnlockId,
            jobRequestId: review.jobRequestId,
            offerId: review.offerId,
          },
        },
        tx,
      );

      await this.auditLogsService.create(
        {
          adminId: user.id,
          action: 'REVIEW_REMOVED',
          entityType: 'Review',
          entityId: review.id,
          metadata: {
            jobRequestId: review.jobRequestId,
            offerId: review.offerId,
            employerId: review.employerId,
            contractorId: review.contractorId,
            previousStatus: review.status,
            newStatus: ReviewStatus.REMOVED,
          },
        },
        tx,
      );

      return updated;
    });

    return this.toReview(removed);
  }

  async findAdminCompletions(
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<ReturnType<ReviewsService['toCompletion']>>> {
    const [completions, total] = await this.prisma.$transaction([
      this.prisma.jobCompletion.findMany({
        include: completionInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.jobCompletion.count(),
    ]);

    return {
      data: completions.map((completion) => this.toCompletion(completion)),
      pagination: paginationMeta(query.page, query.limit, total),
    };
  }

  async findAdminCompletion(completionId: string) {
    const completion = await this.prisma.jobCompletion.findUnique({
      where: { id: completionId },
      include: completionInclude,
    });

    if (!completion) {
      throw new NotFoundException('Completion not found.');
    }

    return this.toCompletion(completion);
  }

  private async getUnlockedContact(contactId: string) {
    const contact = await this.prisma.contactUnlock.findUnique({
      where: { id: contactId },
      include: {
        jobRequest: {
          include: {
            images: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        offer: true,
        employer: {
          select: userSelect,
        },
        contractor: {
          select: userSelect,
        },
      },
    });

    if (!contact || contact.status !== ContactUnlockStatus.UNLOCKED) {
      throw new NotFoundException('Unlocked contact relationship not found.');
    }

    return contact;
  }

  private assertCanViewContact(
    user: AuthenticatedUser,
    contact: { employerId: string; contractorId: string },
  ) {
    if (user.role === UserRole.ADMIN || contact.employerId === user.id || contact.contractorId === user.id) {
      return;
    }

    throw new ForbiddenException('You cannot access this contact relationship.');
  }

  private async assertContractorExists(contractorId: string) {
    const contractor = await this.prisma.user.findUnique({
      where: { id: contractorId },
      select: { id: true, role: true },
    });

    if (!contractor || contractor.role !== UserRole.CONTRACTOR) {
      throw new NotFoundException('Contractor not found.');
    }
  }

  private async recalculateRatingSummary(tx: Prisma.TransactionClient, contractorId: string) {
    const aggregate = await tx.review.aggregate({
      where: {
        contractorId,
        status: ReviewStatus.ACTIVE,
        removedAt: null,
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const totalReviews = aggregate._count.rating;
    const averageRating = aggregate._avg.rating ?? 0;

    await tx.contractorRatingSummary.upsert({
      where: { contractorId },
      create: {
        contractorId,
        averageRating: new Prisma.Decimal(averageRating.toFixed(2)),
        totalReviews,
      },
      update: {
        averageRating: new Prisma.Decimal(averageRating.toFixed(2)),
        totalReviews,
      },
    });
  }

  private sanitizeOptional(value?: string) {
    const cleaned = value?.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
    return cleaned || undefined;
  }

  private sanitizeRequired(value: string, message: string) {
    const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
    if (!cleaned) {
      throw new BadRequestException(message);
    }

    return cleaned;
  }

  private toCompletion(completion: CompletionWithRelations) {
    return {
      id: completion.id,
      jobRequestId: completion.jobRequestId,
      offerId: completion.offerId,
      contactUnlockId: completion.contactUnlockId,
      employerId: completion.employerId,
      contractorId: completion.contractorId,
      status: completion.status,
      contractorMarkedAt: completion.contractorMarkedAt,
      employerConfirmedAt: completion.employerConfirmedAt,
      createdAt: completion.createdAt,
      updatedAt: completion.updatedAt,
      jobRequest: {
        id: completion.jobRequest.id,
        title: completion.jobRequest.title,
        description: completion.jobRequest.description,
        category: completion.jobRequest.category,
        subcategory: completion.jobRequest.subcategory,
        location: completion.jobRequest.location,
        status: completion.jobRequest.status,
        expiresAt: completion.jobRequest.expiresAt,
        images: completion.jobRequest.images,
        createdAt: completion.jobRequest.createdAt,
        updatedAt: completion.jobRequest.updatedAt,
      },
      offer: {
        id: completion.offer.id,
        estimatedPrice: completion.offer.estimatedPrice.toString(),
        startDate: completion.offer.startDate,
        estimatedCompletionDays: completion.offer.estimatedCompletionDays,
        message: completion.offer.message,
        status: completion.offer.status,
        selectedByEmployer: completion.offer.selectedByEmployer,
        createdAt: completion.offer.createdAt,
        updatedAt: completion.offer.updatedAt,
      },
      employer: completion.employer,
      contractor: completion.contractor,
    };
  }

  private toReview(review: Review | ReviewWithRelations) {
    const related = 'jobRequest' in review ? review : null;

    return {
      id: review.id,
      jobRequestId: review.jobRequestId,
      offerId: review.offerId,
      contactUnlockId: review.contactUnlockId,
      employerId: review.employerId,
      contractorId: review.contractorId,
      rating: review.rating,
      comment: review.comment,
      contractorReply: review.contractorReply,
      contractorReplyAt: review.contractorReplyAt,
      status: review.status,
      removedByAdminId: review.removedByAdminId,
      removedAt: review.removedAt,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      jobRequest: related
        ? {
            id: related.jobRequest.id,
            title: related.jobRequest.title,
            description: related.jobRequest.description,
            category: related.jobRequest.category,
            subcategory: related.jobRequest.subcategory,
            location: related.jobRequest.location,
            status: related.jobRequest.status,
            expiresAt: related.jobRequest.expiresAt,
            images: related.jobRequest.images,
            createdAt: related.jobRequest.createdAt,
            updatedAt: related.jobRequest.updatedAt,
          }
        : undefined,
      offer: related
        ? {
            id: related.offer.id,
            estimatedPrice: related.offer.estimatedPrice.toString(),
            startDate: related.offer.startDate,
            estimatedCompletionDays: related.offer.estimatedCompletionDays,
            message: related.offer.message,
            status: related.offer.status,
            selectedByEmployer: related.offer.selectedByEmployer,
            createdAt: related.offer.createdAt,
            updatedAt: related.offer.updatedAt,
          }
        : undefined,
      employer: related?.employer,
      contractor: related?.contractor,
      removedByAdmin: related?.removedByAdmin,
    };
  }

  private toRatingSummary(summary: {
    id: string | null;
    contractorId: string;
    averageRating: Prisma.Decimal;
    totalReviews: number;
    createdAt: Date | null;
    updatedAt: Date | null;
  }) {
    return {
      id: summary.id,
      contractorId: summary.contractorId,
      averageRating: summary.averageRating.toString(),
      totalReviews: summary.totalReviews,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
    };
  }
}
