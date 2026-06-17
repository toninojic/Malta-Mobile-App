import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContactUnlockStatus,
  JobStatus,
  NotificationType,
  Offer,
  OfferRejectionReason,
  OfferStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { paginationMeta } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { OffersQueryDto } from './dto/offers-query.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';

const offerInclude = {
  contactUnlock: true,
  completion: true,
  review: true,
  employerReview: true,
  contractor: {
    select: {
      id: true,
      email: true,
      status: true,
      profile: true,
      ratingSummary: true,
      portfolioImages: {
        orderBy: { sortOrder: 'asc' as const },
        take: 10,
      },
      verificationRequests: {
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        select: {
          status: true,
        },
      },
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
          status: true,
          profile: true,
          employerRatingSummary: true,
        },
      },
    },
  },
};

type OfferWithRelations = Prisma.OfferGetPayload<{ include: typeof offerInclude }>;
type WorkDetailsAction =
  | 'EDIT_OFFER'
  | 'WITHDRAW_OFFER'
  | 'UNLOCK_CONTACT'
  | 'OPEN_CHAT'
  | 'MARK_COMPLETED'
  | 'VIEW_REVIEW'
  | 'VIEW_DETAILS';

const OFFER_CONTACT_DETAILS_ERROR =
  'Contact details are not allowed in offers. Contact unlock is available after token payment.';

@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(user: AuthenticatedUser, jobId: string, dto: CreateOfferDto) {
    this.assertContractor(user);
    this.assertOfferMessageHasNoContactDetails(dto.message);
    await this.expireStaleJobs();

    const job = await this.prisma.jobRequest.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        employerId: true,
        status: true,
        expiresAt: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job request not found.');
    }

    if (job.employerId === user.id) {
      throw new ForbiddenException('You cannot create an offer for your own job request.');
    }

    if (job.status !== JobStatus.ACTIVE || job.expiresAt <= new Date()) {
      throw new BadRequestException('Offers can be created only for active job requests.');
    }

    const activeOffer = await this.prisma.offer.findFirst({
      where: {
        contractorId: user.id,
        jobRequestId: jobId,
        status: { in: [OfferStatus.PENDING, OfferStatus.SELECTED] },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (activeOffer) {
      throw new ConflictException('You already have an active offer for this job request.');
    }

    try {
      const offer = await this.prisma.$transaction(async (tx) => {
        const created = await tx.offer.create({
          data: {
            jobRequestId: jobId,
            contractorId: user.id,
            estimatedPrice: new Prisma.Decimal(dto.estimatedPrice),
            startDate: this.parseStartDate(dto.startDate),
            estimatedCompletionDays: dto.estimatedCompletionDays,
            message: dto.message,
          },
          include: offerInclude,
        });

        await this.notificationsService.create(
          {
            userId: job.employerId,
            type: NotificationType.NEW_OFFER,
            title: 'New offer received',
            body: 'You received a new offer for your job.',
            data: {
              jobId,
              offerId: created.id,
              contractorId: user.id,
            },
          },
          tx,
        );

        return created;
      });

      return this.toContractorOffer(offer);
    } catch (error) {
      if (this.isPrismaError(error, 'P2002')) {
        throw new ConflictException('You already submitted an offer for this job request.');
      }

      throw error;
    }
  }

  async update(user: AuthenticatedUser, offerId: string, dto: UpdateOfferDto) {
    this.assertContractor(user);
    this.assertOfferMessageHasNoContactDetails(dto.message);

    const offer = await this.getContractorOfferOrThrow(user, offerId);
    this.assertMutableOffer(offer);

    const updated = await this.prisma.offer.update({
      where: { id: offerId },
      data: {
        estimatedPrice: dto.estimatedPrice === undefined ? undefined : new Prisma.Decimal(dto.estimatedPrice),
        startDate: dto.startDate === undefined ? undefined : this.parseStartDate(dto.startDate),
        estimatedCompletionDays: dto.estimatedCompletionDays,
        message: dto.message,
      },
      include: offerInclude,
    });

    return this.toContractorOffer(updated);
  }

  async withdraw(user: AuthenticatedUser, offerId: string) {
    this.assertContractor(user);

    const offer = await this.getContractorOfferOrThrow(user, offerId);

    if (offer.status === OfferStatus.WITHDRAWN || offer.deletedAt) {
      throw new BadRequestException('Offer has already been withdrawn.');
    }

    if (offer.status === OfferStatus.REJECTED) {
      throw new BadRequestException('Rejected offers cannot be withdrawn.');
    }

    if (offer.status === OfferStatus.COMPLETED) {
      throw new BadRequestException('Completed offers cannot be withdrawn.');
    }

    const updated = await this.prisma.offer.update({
      where: { id: offerId },
      data: {
        status: OfferStatus.WITHDRAWN,
        selectedByEmployer: false,
        deletedAt: new Date(),
      },
      include: offerInclude,
    });

    return this.toContractorOffer(updated);
  }

  async findMine(user: AuthenticatedUser, query: OffersQueryDto) {
    this.assertContractor(user);

    const where: Prisma.OfferWhereInput = {
      contractorId: user.id,
      ...(query.status ? { status: query.status } : {}),
    };

    const [offers, total] = await this.prisma.$transaction([
      this.prisma.offer.findMany({
        where,
        include: offerInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.offer.count({ where }),
    ]);

    return {
      data: offers.map((offer) => this.toContractorOffer(offer)),
      pagination: paginationMeta(query.page, query.limit, total),
    };
  }

  async findForJob(user: AuthenticatedUser, jobId: string, query: OffersQueryDto) {
    await this.assertCanViewJobOffers(user, jobId);

    const where: Prisma.OfferWhereInput = {
      jobRequestId: jobId,
      deletedAt: null,
      status: query.status ?? { not: OfferStatus.WITHDRAWN },
    };

    const offers = await this.prisma.offer.findMany({
      where,
      include: offerInclude,
    });
    const randomizedOffers = this.shuffle(offers);
    const total = randomizedOffers.length;
    const pageStart = (query.page - 1) * query.limit;
    const pageItems = randomizedOffers.slice(pageStart, pageStart + query.limit);

    return {
      data: pageItems.map((offer) =>
        user.role === UserRole.ADMIN ? this.toAdminOffer(offer) : this.toEmployerOffer(offer),
      ),
      pagination: paginationMeta(query.page, query.limit, total),
    };
  }

  async findAll(user: AuthenticatedUser, query: OffersQueryDto) {
    this.assertAdmin(user);

    const where: Prisma.OfferWhereInput = {
      ...(query.status ? { status: query.status } : {}),
    };

    const [offers, total] = await this.prisma.$transaction([
      this.prisma.offer.findMany({
        where,
        include: offerInclude,
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

  async findOneAdmin(user: AuthenticatedUser, offerId: string) {
    this.assertAdmin(user);

    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: offerInclude,
    });

    if (!offer) {
      throw new NotFoundException('Offer not found.');
    }

    return this.toAdminOffer(offer);
  }

  async findWorkDetails(user: AuthenticatedUser, offerId: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        ...offerInclude,
        contactUnlock: {
          include: {
            conversation: true,
          },
        },
      },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found.');
    }

    this.assertCanViewWorkDetails(user, offer);

    const isUnlocked = offer.contactUnlock?.status === ContactUnlockStatus.UNLOCKED;
    const canSeeEmployer = user.role === UserRole.ADMIN || user.id === offer.jobRequest.employerId || (user.id === offer.contractorId && isUnlocked);
    const canSeeContractorPrivate = user.role === UserRole.ADMIN || user.id === offer.contractorId || (user.id === offer.jobRequest.employerId && isUnlocked);

    return {
      offer: this.toWorkOffer(offer),
      job: {
        id: offer.jobRequest.id,
        title: offer.jobRequest.title,
        description: offer.jobRequest.description,
        category: offer.jobRequest.category,
        subcategory: offer.jobRequest.subcategory,
        location: offer.jobRequest.location,
        status: offer.jobRequest.status,
        expiresAt: offer.jobRequest.expiresAt,
        images: offer.jobRequest.images,
        createdAt: offer.jobRequest.createdAt,
        updatedAt: offer.jobRequest.updatedAt,
      },
      contactUnlock: offer.contactUnlock
        ? {
            id: offer.contactUnlock.id,
            jobRequestId: offer.contactUnlock.jobRequestId,
            offerId: offer.contactUnlock.offerId,
            employerId: offer.contactUnlock.employerId,
            contractorId: offer.contactUnlock.contractorId,
            status: offer.contactUnlock.status,
            createdAt: offer.contactUnlock.createdAt,
            updatedAt: offer.contactUnlock.updatedAt,
          }
        : null,
      completion: offer.completion
        ? {
            id: offer.completion.id,
            jobRequestId: offer.completion.jobRequestId,
            offerId: offer.completion.offerId,
            contactUnlockId: offer.completion.contactUnlockId,
            employerId: offer.completion.employerId,
            contractorId: offer.completion.contractorId,
            status: offer.completion.status,
            contractorMarkedAt: offer.completion.contractorMarkedAt,
            employerConfirmedAt: offer.completion.employerConfirmedAt,
            createdAt: offer.completion.createdAt,
            updatedAt: offer.completion.updatedAt,
          }
        : null,
      review: offer.review
        ? {
            id: offer.review.id,
            jobRequestId: offer.review.jobRequestId,
            offerId: offer.review.offerId,
            contactUnlockId: offer.review.contactUnlockId,
            employerId: offer.review.employerId,
            contractorId: offer.review.contractorId,
            rating: offer.review.rating,
            comment: offer.review.comment,
            contractorReply: offer.review.contractorReply,
            contractorReplyAt: offer.review.contractorReplyAt,
            status: offer.review.status,
            createdAt: offer.review.createdAt,
            updatedAt: offer.review.updatedAt,
          }
        : null,
      employerReview: offer.employerReview
        ? {
            id: offer.employerReview.id,
            jobRequestId: offer.employerReview.jobRequestId,
            offerId: offer.employerReview.offerId,
            contactUnlockId: offer.employerReview.contactUnlockId,
            employerId: offer.employerReview.employerId,
            contractorId: offer.employerReview.contractorId,
            rating: offer.employerReview.rating,
            comment: offer.employerReview.comment,
            status: offer.employerReview.status,
            createdAt: offer.employerReview.createdAt,
            updatedAt: offer.employerReview.updatedAt,
          }
        : null,
      conversation: offer.contactUnlock?.conversation
        ? {
            id: offer.contactUnlock.conversation.id,
            contactUnlockId: offer.contactUnlock.conversation.contactUnlockId,
            lastMessageAt: offer.contactUnlock.conversation.lastMessageAt,
            createdAt: offer.contactUnlock.conversation.createdAt,
            updatedAt: offer.contactUnlock.conversation.updatedAt,
          }
        : null,
      employer: canSeeEmployer ? offer.jobRequest.employer : null,
      employerRatingSummary: offer.jobRequest.employer.employerRatingSummary
        ? {
            averageRating: offer.jobRequest.employer.employerRatingSummary.averageRating.toString(),
            totalReviews: offer.jobRequest.employer.employerRatingSummary.totalReviews,
          }
        : { averageRating: '0', totalReviews: 0 },
      contractor: {
        id: offer.contractor.id,
        email: canSeeContractorPrivate ? offer.contractor.email : undefined,
        status: canSeeContractorPrivate ? offer.contractor.status : undefined,
        profile: {
          id: offer.contractor.profile?.id,
          userId: offer.contractor.profile?.userId,
          displayName: offer.contractor.profile?.displayName,
          location: offer.contractor.profile?.location,
          bio: offer.contractor.profile?.bio,
          avatarUrl: offer.contractor.profile?.avatarUrl,
          companyName: offer.contractor.profile?.companyName,
          tradeCategories: offer.contractor.profile?.tradeCategories ?? [],
          phone: canSeeContractorPrivate ? offer.contractor.profile?.phone : undefined,
        },
        ratingSummary: offer.contractor.ratingSummary
          ? {
              averageRating: offer.contractor.ratingSummary.averageRating.toString(),
              totalReviews: offer.contractor.ratingSummary.totalReviews,
            }
          : null,
        portfolioImages: offer.contractor.portfolioImages,
        verificationStatus: offer.contractor.verificationRequests[0]?.status ?? 'UNVERIFIED',
      },
      availableActions: this.availableActions(user, offer),
    };
  }

  async select(user: AuthenticatedUser, offerId: string) {
    if (user.role !== UserRole.EMPLOYER) {
      throw new ForbiddenException('Only the employer who owns the job request can select an offer.');
    }

    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: offerInclude,
    });

    if (!offer || offer.deletedAt || offer.status === OfferStatus.WITHDRAWN) {
      throw new NotFoundException('Offer not found.');
    }

    if (offer.jobRequest.employerId !== user.id) {
      throw new ForbiddenException('You can select offers only for your own job requests.');
    }

    if (offer.jobRequest.status !== JobStatus.ACTIVE) {
      throw new BadRequestException('Offers can be selected only for active job requests.');
    }

    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException('Only pending offers can be selected.');
    }

    try {
      const selected = await this.prisma.$transaction(async (tx) => {
        await tx.offer.updateMany({
          where: {
            jobRequestId: offer.jobRequestId,
            id: { not: offerId },
            status: OfferStatus.PENDING,
            deletedAt: null,
          },
          data: {
            status: OfferStatus.REJECTED,
            selectedByEmployer: false,
            rejectionReason: OfferRejectionReason.AUTO_REJECTED_BY_SELECTION,
          },
        });

        const contactUnlock = await tx.contactUnlock.upsert({
          where: { offerId },
          create: {
            jobRequestId: offer.jobRequestId,
            offerId,
            employerId: offer.jobRequest.employerId,
            contractorId: offer.contractorId,
            status: ContactUnlockStatus.PENDING,
          },
          update: {
            status: ContactUnlockStatus.PENDING,
          },
        });

        await tx.jobRequest.update({
          where: { id: offer.jobRequestId },
          data: { status: JobStatus.IN_PROGRESS },
        });

        await this.notificationsService.create(
          {
            userId: offer.contractorId,
            type: NotificationType.OFFER_SELECTED,
            title: 'Offer selected',
            body: 'Your offer was selected. Unlock contact to start conversation.',
            data: {
              jobId: offer.jobRequestId,
              offerId,
              contactUnlockId: contactUnlock.id,
              employerId: offer.jobRequest.employerId,
            },
          },
          tx,
        );

        return tx.offer.update({
          where: { id: offerId },
          data: {
            status: OfferStatus.SELECTED,
            selectedByEmployer: true,
            rejectionReason: null,
          },
          include: offerInclude,
        });
      });

      return this.toEmployerOffer(selected);
    } catch (error) {
      if (this.isPrismaError(error, 'P2002')) {
        throw new ConflictException('Only one offer can be selected for a job request.');
      }

      throw error;
    }
  }

  async reject(user: AuthenticatedUser, offerId: string) {
    if (user.role !== UserRole.EMPLOYER) {
      throw new ForbiddenException('Only the employer who owns the job request can reject an offer.');
    }

    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: offerInclude,
    });

    if (!offer || offer.deletedAt) {
      throw new NotFoundException('Offer not found.');
    }

    if (offer.jobRequest.employerId !== user.id) {
      throw new ForbiddenException('You can reject offers only for your own job requests.');
    }

    if (offer.status === OfferStatus.COMPLETED) {
      throw new BadRequestException('Completed offers cannot be rejected.');
    }

    if (offer.status === OfferStatus.WITHDRAWN) {
      throw new BadRequestException('Withdrawn offers cannot be rejected.');
    }

    if (offer.status === OfferStatus.REJECTED) {
      throw new BadRequestException('Offer has already been rejected.');
    }

    if (offer.status === OfferStatus.SELECTED) {
      throw new BadRequestException('Use cancel selection for selected offers.');
    }

    const rejected = await this.prisma.offer.update({
      where: { id: offerId },
      data: {
        status: OfferStatus.REJECTED,
        selectedByEmployer: false,
        rejectionReason: OfferRejectionReason.MANUALLY_REJECTED_BY_EMPLOYER,
      },
      include: offerInclude,
    });

    return this.toEmployerOffer(rejected);
  }

  async cancelSelection(user: AuthenticatedUser, offerId: string) {
    if (user.role !== UserRole.EMPLOYER) {
      throw new ForbiddenException('Only the employer who owns the job request can cancel a selection.');
    }

    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: offerInclude,
    });

    if (!offer || offer.deletedAt) {
      throw new NotFoundException('Offer not found.');
    }

    if (offer.jobRequest.employerId !== user.id) {
      throw new ForbiddenException('You can cancel selections only for your own job requests.');
    }

    if (offer.status !== OfferStatus.SELECTED || !offer.selectedByEmployer) {
      throw new BadRequestException('Only selected offers can have selection cancelled.');
    }

    if (offer.contactUnlock?.status === ContactUnlockStatus.UNLOCKED) {
      throw new BadRequestException('Selection cannot be cancelled after contact is unlocked.');
    }

    const cancelled = await this.prisma.$transaction(async (tx) => {
      await tx.jobRequest.update({
        where: { id: offer.jobRequestId },
        data: { status: JobStatus.ACTIVE },
      });

      await tx.offer.updateMany({
        where: {
          jobRequestId: offer.jobRequestId,
          status: OfferStatus.REJECTED,
          rejectionReason: OfferRejectionReason.AUTO_REJECTED_BY_SELECTION,
          deletedAt: null,
        },
        data: {
          status: OfferStatus.PENDING,
          rejectionReason: null,
          selectedByEmployer: false,
        },
      });

      return tx.offer.update({
        where: { id: offerId },
        data: {
          status: OfferStatus.REJECTED,
          selectedByEmployer: false,
          rejectionReason: OfferRejectionReason.SELECTION_CANCELLED_BY_EMPLOYER,
        },
        include: offerInclude,
      });
    });

    return this.toEmployerOffer(cancelled);
  }

  private async getContractorOfferOrThrow(user: AuthenticatedUser, offerId: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: offerInclude,
    });

    if (!offer) {
      throw new NotFoundException('Offer not found.');
    }

    if (offer.contractorId !== user.id) {
      throw new ForbiddenException('You can manage only your own offers.');
    }

    return offer;
  }

  private async assertCanViewJobOffers(user: AuthenticatedUser, jobId: string) {
    if (user.role === UserRole.ADMIN) {
      return;
    }

    if (user.role !== UserRole.EMPLOYER) {
      throw new ForbiddenException('Only employers can view offers for job requests.');
    }

    const job = await this.prisma.jobRequest.findUnique({
      where: { id: jobId },
      select: { id: true, employerId: true },
    });

    if (!job) {
      throw new NotFoundException('Job request not found.');
    }

    if (job.employerId !== user.id) {
      throw new ForbiddenException('You can view offers only for your own job requests.');
    }
  }

  private assertCanViewWorkDetails(user: AuthenticatedUser, offer: OfferWithRelations) {
    if (
      user.role === UserRole.ADMIN ||
      offer.contractorId === user.id ||
      offer.jobRequest.employerId === user.id
    ) {
      return;
    }

    throw new ForbiddenException('You cannot access this offer work details.');
  }

  private assertMutableOffer(offer: Offer) {
    if (offer.status === OfferStatus.WITHDRAWN || offer.deletedAt) {
      throw new BadRequestException('Withdrawn offers cannot be edited.');
    }

    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException('Only pending offers can be edited.');
    }
  }

  private parseStartDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Start date must be a valid date.');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    if (startDate < today) {
      throw new BadRequestException('Start date cannot be in the past.');
    }

    return date;
  }

  private assertOfferMessageHasNoContactDetails(message?: string | null) {
    if (!message?.trim()) {
      return;
    }

    if (this.containsContactDetails(message)) {
      throw new BadRequestException(OFFER_CONTACT_DETAILS_ERROR);
    }
  }

  private containsContactDetails(value: string) {
    const text = value.toLowerCase();
    const emailPattern = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;
    const urlPattern =
      /\b(?:https?:\/\/|www\.|wa\.me\/|t\.me\/|(?:instagram|facebook|linkedin|telegram|whatsapp|viber)\.com\/)[^\s]+/i;
    const contactPhrasePattern =
      /\b(?:call|text|sms|whatsapp|viber|email|e-mail|dm|direct message|contact|reach)\s+(?:me|my|us)\b/i;
    const socialHandlePattern = /\b(?:instagram|facebook|telegram|whatsapp|viber|linkedin)\s*[:@]\s*[a-z0-9_.-]{3,}/i;

    return (
      emailPattern.test(text) ||
      urlPattern.test(text) ||
      contactPhrasePattern.test(text) ||
      socialHandlePattern.test(text) ||
      this.containsPhoneLikeNumber(text)
    );
  }

  private containsPhoneLikeNumber(value: string) {
    const phoneCandidatePattern = /(?:^|[^\w])(?:\+?\d[\d\s().-]{6,}\d)(?=$|[^\w])/g;
    const dateLikePattern =
      /^\s*(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\s*$/;
    let match: RegExpExecArray | null;

    while ((match = phoneCandidatePattern.exec(value))) {
      const candidate = match[0].trim();
      const digitCount = candidate.replace(/\D/g, '').length;

      if (digitCount >= 8 && digitCount <= 15 && !dateLikePattern.test(candidate)) {
        return true;
      }
    }

    return false;
  }

  private availableActions(user: AuthenticatedUser, offer: OfferWithRelations): WorkDetailsAction[] {
    if (user.role !== UserRole.CONTRACTOR || offer.contractorId !== user.id) {
      return ['VIEW_DETAILS'];
    }

    const actions: WorkDetailsAction[] = ['VIEW_DETAILS'];
    const isCompleted = offer.status === OfferStatus.COMPLETED;
    const isTerminal =
      isCompleted ||
      offer.jobRequest.status === JobStatus.CLOSED ||
      offer.status === OfferStatus.WITHDRAWN ||
      offer.status === OfferStatus.REJECTED ||
      Boolean(offer.deletedAt);
    const isUnlocked = offer.contactUnlock?.status === ContactUnlockStatus.UNLOCKED;
    const completionStatus = offer.completion?.status;

    if (isCompleted) {
      if (isUnlocked) {
        actions.push('OPEN_CHAT');
      }
      if (offer.review) {
        actions.push('VIEW_REVIEW');
      }
      return actions;
    }

    if (isTerminal) {
      return actions;
    }

    if (offer.status === OfferStatus.PENDING) {
      actions.push('EDIT_OFFER', 'WITHDRAW_OFFER');
      return actions;
    }

    if (offer.status === OfferStatus.SELECTED && !isUnlocked) {
      actions.push('UNLOCK_CONTACT');
      return actions;
    }

    if (isUnlocked) {
      actions.push('OPEN_CHAT');
      if (!completionStatus) {
        actions.push('MARK_COMPLETED');
      }
      if (offer.review) {
        actions.push('VIEW_REVIEW');
      }
    }

    return actions;
  }

  private assertContractor(user: AuthenticatedUser) {
    if (user.role !== UserRole.CONTRACTOR) {
      throw new ForbiddenException('Only contractors can manage offers.');
    }
  }

  private assertAdmin(user: AuthenticatedUser) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can access this resource.');
    }
  }

  private async expireStaleJobs() {
    await this.prisma.jobRequest.updateMany({
      where: {
        status: JobStatus.ACTIVE,
        expiresAt: {
          lt: new Date(),
        },
      },
      data: {
        status: JobStatus.EXPIRED,
      },
    });
  }

  private isPrismaError(error: unknown, code: string) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
  }

  private shuffle<T>(items: T[]) {
    return [...items].sort(() => Math.random() - 0.5);
  }

  private toEmployerOffer(offer: OfferWithRelations) {
    const isUnlocked = offer.contactUnlock?.status === ContactUnlockStatus.UNLOCKED;

    return {
      id: offer.id,
      jobRequestId: offer.jobRequestId,
      estimatedPrice: offer.estimatedPrice.toString(),
      startDate: offer.startDate,
      estimatedCompletionDays: offer.estimatedCompletionDays,
      message: offer.message,
      status: offer.status,
      selectedByEmployer: offer.selectedByEmployer,
      rejectionReason: offer.rejectionReason,
      unlockStatus: offer.contactUnlock?.status ?? 'LOCKED',
      contactId: offer.contactUnlock?.id ?? null,
      rating: offer.contractor.ratingSummary ? Number(offer.contractor.ratingSummary.averageRating) : null,
      totalReviews: offer.contractor.ratingSummary?.totalReviews ?? 0,
      portfolioImages: offer.contractor.portfolioImages,
      verificationStatus: offer.contractor.verificationRequests[0]?.status ?? 'UNVERIFIED',
      completionStatus: offer.completion?.status ?? null,
      contractor: isUnlocked ? offer.contractor : undefined,
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
    };
  }

  private toContractorOffer(offer: OfferWithRelations) {
    const isUnlocked = offer.contactUnlock?.status === ContactUnlockStatus.UNLOCKED;

    return {
      id: offer.id,
      jobRequestId: offer.jobRequestId,
      estimatedPrice: offer.estimatedPrice.toString(),
      startDate: offer.startDate,
      estimatedCompletionDays: offer.estimatedCompletionDays,
      message: offer.message,
      status: offer.status,
      selectedByEmployer: offer.selectedByEmployer,
      rejectionReason: offer.rejectionReason,
      unlockStatus: offer.contactUnlock?.status ?? 'LOCKED',
      contactId: offer.contactUnlock?.id ?? null,
      deletedAt: offer.deletedAt,
      completionStatus: offer.completion?.status ?? null,
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
      jobRequest: {
        id: offer.jobRequest.id,
        title: offer.jobRequest.title,
        description: offer.jobRequest.description,
        category: offer.jobRequest.category,
        subcategory: offer.jobRequest.subcategory,
        location: offer.jobRequest.location,
        status: offer.jobRequest.status,
        expiresAt: offer.jobRequest.expiresAt,
        images: offer.jobRequest.images,
        createdAt: offer.jobRequest.createdAt,
        updatedAt: offer.jobRequest.updatedAt,
      },
      employer: isUnlocked ? offer.jobRequest.employer : undefined,
      employerRatingSummary: offer.jobRequest.employer.employerRatingSummary
        ? {
            averageRating: offer.jobRequest.employer.employerRatingSummary.averageRating.toString(),
            totalReviews: offer.jobRequest.employer.employerRatingSummary.totalReviews,
          }
        : { averageRating: '0', totalReviews: 0 },
    };
  }

  private toAdminOffer(offer: OfferWithRelations) {
    return {
      id: offer.id,
      jobRequestId: offer.jobRequestId,
      contractorId: offer.contractorId,
      estimatedPrice: offer.estimatedPrice.toString(),
      startDate: offer.startDate,
      estimatedCompletionDays: offer.estimatedCompletionDays,
      message: offer.message,
      status: offer.status,
      selectedByEmployer: offer.selectedByEmployer,
      rejectionReason: offer.rejectionReason,
      unlockStatus: offer.contactUnlock?.status ?? 'LOCKED',
      contactId: offer.contactUnlock?.id ?? null,
      deletedAt: offer.deletedAt,
      contractor: offer.contractor,
      completionStatus: offer.completion?.status ?? null,
      jobRequest: offer.jobRequest,
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
    };
  }

  private toWorkOffer(offer: OfferWithRelations) {
    return {
      id: offer.id,
      jobRequestId: offer.jobRequestId,
      contractorId: offer.contractorId,
      estimatedPrice: offer.estimatedPrice.toString(),
      startDate: offer.startDate,
      estimatedCompletionDays: offer.estimatedCompletionDays,
      message: offer.message,
      status: offer.status,
      selectedByEmployer: offer.selectedByEmployer,
      rejectionReason: offer.rejectionReason,
      unlockStatus: offer.contactUnlock?.status ?? 'LOCKED',
      contactId: offer.contactUnlock?.id ?? null,
      completionStatus: offer.completion?.status ?? null,
      reviewId: offer.review?.id ?? null,
      deletedAt: offer.deletedAt,
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
    };
  }
}
