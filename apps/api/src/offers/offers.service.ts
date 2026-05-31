import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContactUnlockStatus, JobStatus, NotificationType, Offer, OfferStatus, Prisma, UserRole } from '@prisma/client';
import { paginationMeta } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { OffersQueryDto } from './dto/offers-query.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';

const offerInclude = {
  contactUnlock: true,
  contractor: {
    select: {
      id: true,
      email: true,
      status: true,
      profile: true,
      ratingSummary: true,
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
        },
      },
    },
  },
};

type OfferWithRelations = Prisma.OfferGetPayload<{ include: typeof offerInclude }>;

@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(user: AuthenticatedUser, jobId: string, dto: CreateOfferDto) {
    this.assertContractor(user);
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

    const offer = await this.getContractorOfferOrThrow(user, offerId);
    this.assertMutableOffer(offer);

    const updated = await this.prisma.offer.update({
      where: { id: offerId },
      data: {
        estimatedPrice: dto.estimatedPrice === undefined ? undefined : new Prisma.Decimal(dto.estimatedPrice),
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

    const selected = await this.prisma.$transaction(async (tx) => {
      await tx.offer.updateMany({
        where: {
          jobRequestId: offer.jobRequestId,
          selectedByEmployer: true,
          status: OfferStatus.SELECTED,
        },
        data: {
          status: OfferStatus.PENDING,
          selectedByEmployer: false,
        },
      });

      return tx.offer.update({
        where: { id: offerId },
        data: {
          status: OfferStatus.SELECTED,
          selectedByEmployer: true,
        },
        include: offerInclude,
      });
    });

    return this.toEmployerOffer(selected);
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

  private assertMutableOffer(offer: Offer) {
    if (offer.status === OfferStatus.WITHDRAWN || offer.deletedAt) {
      throw new BadRequestException('Withdrawn offers cannot be edited.');
    }
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
      estimatedCompletionDays: offer.estimatedCompletionDays,
      message: offer.message,
      status: offer.status,
      selectedByEmployer: offer.selectedByEmployer,
      unlockStatus: offer.contactUnlock?.status ?? 'LOCKED',
      contactId: offer.contactUnlock?.id ?? null,
      rating: offer.contractor.ratingSummary ? Number(offer.contractor.ratingSummary.averageRating) : null,
      totalReviews: offer.contractor.ratingSummary?.totalReviews ?? 0,
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
      estimatedCompletionDays: offer.estimatedCompletionDays,
      message: offer.message,
      status: offer.status,
      selectedByEmployer: offer.selectedByEmployer,
      unlockStatus: offer.contactUnlock?.status ?? 'LOCKED',
      contactId: offer.contactUnlock?.id ?? null,
      deletedAt: offer.deletedAt,
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
    };
  }

  private toAdminOffer(offer: OfferWithRelations) {
    return {
      id: offer.id,
      jobRequestId: offer.jobRequestId,
      contractorId: offer.contractorId,
      estimatedPrice: offer.estimatedPrice.toString(),
      estimatedCompletionDays: offer.estimatedCompletionDays,
      message: offer.message,
      status: offer.status,
      selectedByEmployer: offer.selectedByEmployer,
      unlockStatus: offer.contactUnlock?.status ?? 'LOCKED',
      contactId: offer.contactUnlock?.id ?? null,
      deletedAt: offer.deletedAt,
      contractor: offer.contractor,
      jobRequest: offer.jobRequest,
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
    };
  }
}
