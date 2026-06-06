import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContactUnlockStatus, JobStatus, NotificationType, OfferStatus, Prisma, TokenTransactionType, UserRole } from '@prisma/client';
import { PaginatedResponse, PaginationQueryDto, paginationMeta } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminContactsQueryDto } from './dto/admin-contacts-query.dto';

const CONTACT_UNLOCK_COST = 1;

const contactInclude = {
  jobRequest: {
    include: {
      images: {
        orderBy: { sortOrder: 'asc' as const },
      },
    },
  },
  offer: true,
  employer: {
    select: {
      id: true,
      email: true,
      status: true,
      profile: true,
    },
  },
  contractor: {
    select: {
      id: true,
      email: true,
      status: true,
      profile: true,
    },
  },
  unlockedByContractor: {
    select: {
      id: true,
      email: true,
      profile: true,
    },
  },
  tokenTransaction: true,
};

type ContactWithRelations = Prisma.ContactUnlockGetPayload<{ include: typeof contactInclude }>;

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async requestContact(user: AuthenticatedUser, offerId: string) {
    if (user.role !== UserRole.EMPLOYER) {
      throw new ForbiddenException('Only employers can request contact.');
    }

    const offer = await this.getOfferForUnlock(offerId);

    if (offer.jobRequest.employerId !== user.id) {
      throw new ForbiddenException('You can request contact only for offers on your own job requests.');
    }

    if (offer.contactUnlock) {
      return this.toUnlockStatus(offer, offer.contactUnlock);
    }

    const contact = await this.prisma.contactUnlock.create({
      data: {
        jobRequestId: offer.jobRequestId,
        offerId: offer.id,
        employerId: offer.jobRequest.employerId,
        contractorId: offer.contractorId,
        status: ContactUnlockStatus.PENDING,
      },
    });

    return this.toUnlockStatus(offer, contact);
  }

  async unlockOffer(user: AuthenticatedUser, offerId: string) {
    if (user.role !== UserRole.CONTRACTOR) {
      throw new ForbiddenException('Only contractors can unlock contact information.');
    }

    const offer = await this.getOfferForUnlock(offerId);

    if (offer.contractorId !== user.id) {
      throw new ForbiddenException('You can unlock contact only for your own offers.');
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const existingContact = await tx.contactUnlock.findUnique({
          where: { offerId },
        });

        if (existingContact?.status === ContactUnlockStatus.UNLOCKED) {
          throw new ConflictException('Contact is already unlocked for this offer.');
        }

        const balanceUpdate = await tx.userTokenBalance.updateMany({
          where: {
            userId: user.id,
            balance: { gte: CONTACT_UNLOCK_COST },
          },
          data: {
            balance: { decrement: CONTACT_UNLOCK_COST },
            version: { increment: 1 },
          },
        });

        if (balanceUpdate.count !== 1) {
          throw new BadRequestException('Insufficient token balance to unlock contact.');
        }

        const wallet = await tx.userTokenBalance.findUniqueOrThrow({
          where: { userId: user.id },
        });

        const transaction = await tx.tokenTransaction.create({
          data: {
            userId: user.id,
            type: TokenTransactionType.SPEND,
            amount: -CONTACT_UNLOCK_COST,
            balanceAfter: wallet.balance,
            description: `Contact unlock for offer ${offer.id}`,
          },
        });

        if (existingContact) {
          const updated = await tx.contactUnlock.updateMany({
            where: {
              id: existingContact.id,
              status: ContactUnlockStatus.PENDING,
            },
            data: {
              status: ContactUnlockStatus.UNLOCKED,
              tokenTransactionId: transaction.id,
              unlockedByContractorId: user.id,
            },
          });

          if (updated.count !== 1) {
            throw new ConflictException('Contact is already unlocked for this offer.');
          }

          const contact = await tx.contactUnlock.findUniqueOrThrow({
            where: { id: existingContact.id },
            include: contactInclude,
          });

          await this.createContactUnlockedNotification(tx, contact);

          return { contact, wallet, transaction };
        }

        const contact = await tx.contactUnlock.create({
          data: {
            jobRequestId: offer.jobRequestId,
            offerId: offer.id,
            employerId: offer.jobRequest.employerId,
            contractorId: offer.contractorId,
            unlockedByContractorId: user.id,
            tokenTransactionId: transaction.id,
            status: ContactUnlockStatus.UNLOCKED,
          },
          include: contactInclude,
        });

        await this.createContactUnlockedNotification(tx, contact);

        return { contact, wallet, transaction };
      });

      return {
        contact: this.toContact(result.contact),
        balance: this.toBalance(result.wallet),
        transaction: this.toTransaction(result.transaction),
      };
    } catch (error) {
      if (this.isPrismaError(error, 'P2002')) {
        throw new ConflictException('Contact is already unlocked for this offer.');
      }

      throw error;
    }
  }

  async getUnlockStatus(user: AuthenticatedUser, offerId: string) {
    const offer = await this.getOfferForStatus(user, offerId);
    return this.toUnlockStatus(offer, offer.contactUnlock);
  }

  async findContacts(
    user: AuthenticatedUser,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<ReturnType<ContactsService['toContact']>>> {
    const where = this.contactWhereForUser(user, true);

    const [contacts, total] = await this.prisma.$transaction([
      this.prisma.contactUnlock.findMany({
        where,
        include: contactInclude,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.contactUnlock.count({ where }),
    ]);

    return {
      data: contacts.map((contact) => this.toContact(contact)),
      pagination: paginationMeta(query.page, query.limit, total),
    };
  }

  async findContact(user: AuthenticatedUser, contactId: string) {
    const contact = await this.prisma.contactUnlock.findUnique({
      where: { id: contactId },
      include: contactInclude,
    });

    if (!contact || contact.status !== ContactUnlockStatus.UNLOCKED) {
      throw new NotFoundException('Contact not found.');
    }

    this.assertCanViewContact(user, contact);
    return this.toContact(contact);
  }

  async findAdminContacts(query: AdminContactsQueryDto): Promise<PaginatedResponse<ReturnType<ContactsService['toContact']>>> {
    const where: Prisma.ContactUnlockWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.employerId ? { employerId: query.employerId } : {}),
      ...(query.contractorId ? { contractorId: query.contractorId } : {}),
      ...(query.jobRequestId ? { jobRequestId: query.jobRequestId } : {}),
    };

    const [contacts, total] = await this.prisma.$transaction([
      this.prisma.contactUnlock.findMany({
        where,
        include: contactInclude,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.contactUnlock.count({ where }),
    ]);

    return {
      data: contacts.map((contact) => this.toContact(contact)),
      pagination: paginationMeta(query.page, query.limit, total),
    };
  }

  async findAdminContact(id: string) {
    const contact = await this.prisma.contactUnlock.findUnique({
      where: { id },
      include: contactInclude,
    });

    if (!contact) {
      throw new NotFoundException('Contact unlock not found.');
    }

    return this.toContact(contact);
  }

  private async getOfferForUnlock(offerId: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        jobRequest: true,
        contactUnlock: true,
      },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found.');
    }

    if (offer.deletedAt || offer.status === OfferStatus.WITHDRAWN || offer.status === OfferStatus.REJECTED) {
      throw new BadRequestException('Inactive offers cannot be unlocked.');
    }

    if (offer.status !== OfferStatus.SELECTED) {
      throw new BadRequestException('Only selected offers can unlock contact information.');
    }

    if (offer.jobRequest.status === JobStatus.CLOSED || offer.jobRequest.status === JobStatus.COMPLETED) {
      throw new BadRequestException('Closed or completed job requests cannot be unlocked.');
    }

    return offer;
  }

  private async getOfferForStatus(user: AuthenticatedUser, offerId: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        jobRequest: true,
        contactUnlock: true,
      },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found.');
    }

    if (user.role === UserRole.ADMIN) {
      return offer;
    }

    if (user.role === UserRole.CONTRACTOR && offer.contractorId === user.id) {
      return offer;
    }

    if (user.role === UserRole.EMPLOYER && offer.jobRequest.employerId === user.id) {
      return offer;
    }

    throw new ForbiddenException('You cannot view unlock status for this offer.');
  }

  private contactWhereForUser(user: AuthenticatedUser, unlockedOnly: boolean): Prisma.ContactUnlockWhereInput {
    const relationWhere =
      user.role === UserRole.CONTRACTOR
        ? { contractorId: user.id }
        : user.role === UserRole.EMPLOYER
          ? { employerId: user.id }
          : {};

    return {
      ...relationWhere,
      ...(unlockedOnly ? { status: ContactUnlockStatus.UNLOCKED } : {}),
    };
  }

  private assertCanViewContact(user: AuthenticatedUser, contact: ContactWithRelations) {
    if (user.role === UserRole.ADMIN) {
      return;
    }

    if (user.role === UserRole.CONTRACTOR && contact.contractorId === user.id) {
      return;
    }

    if (user.role === UserRole.EMPLOYER && contact.employerId === user.id) {
      return;
    }

    throw new ForbiddenException('You cannot view this contact.');
  }

  private toUnlockStatus(
    offer: { id: string; contractorId: string; contactUnlock: { id: string; status: ContactUnlockStatus } | null },
    contactUnlock?: { id: string; status: ContactUnlockStatus } | null,
  ) {
    const status = contactUnlock?.status ?? 'LOCKED';

    return {
      offerId: offer.id,
      contactId: contactUnlock?.id ?? null,
      status,
      isUnlocked: status === ContactUnlockStatus.UNLOCKED,
      requestedByEmployer: status === ContactUnlockStatus.PENDING,
      cost: CONTACT_UNLOCK_COST,
    };
  }

  private async createContactUnlockedNotification(tx: Prisma.TransactionClient, contact: ContactWithRelations) {
    const contractorName = contact.contractor.profile?.displayName ?? contact.contractor.email;

    await this.notificationsService.create(
      {
        userId: contact.employerId,
        type: NotificationType.CONTACT_UNLOCKED,
        title: 'Contact unlocked',
        body: `${contractorName} unlocked contact details for ${contact.jobRequest.title}.`,
        data: {
          contactId: contact.id,
          offerId: contact.offerId,
          jobRequestId: contact.jobRequestId,
        },
      },
      tx,
    );
  }

  private toContact(contact: ContactWithRelations) {
    return {
      id: contact.id,
      jobRequestId: contact.jobRequestId,
      offerId: contact.offerId,
      employerId: contact.employerId,
      contractorId: contact.contractorId,
      unlockedByContractorId: contact.unlockedByContractorId,
      status: contact.status,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
      jobRequest: {
        id: contact.jobRequest.id,
        title: contact.jobRequest.title,
        description: contact.jobRequest.description,
        category: contact.jobRequest.category,
        subcategory: contact.jobRequest.subcategory,
        location: contact.jobRequest.location,
        status: contact.jobRequest.status,
        expiresAt: contact.jobRequest.expiresAt,
        images: contact.jobRequest.images,
        createdAt: contact.jobRequest.createdAt,
        updatedAt: contact.jobRequest.updatedAt,
      },
      offer: {
        id: contact.offer.id,
        estimatedPrice: contact.offer.estimatedPrice.toString(),
        startDate: contact.offer.startDate,
        estimatedCompletionDays: contact.offer.estimatedCompletionDays,
        message: contact.offer.message,
        status: contact.offer.status,
        selectedByEmployer: contact.offer.selectedByEmployer,
        createdAt: contact.offer.createdAt,
        updatedAt: contact.offer.updatedAt,
      },
      employer: contact.employer,
      contractor: contact.contractor,
      unlockedByContractor: contact.unlockedByContractor,
      tokenTransaction: contact.tokenTransaction ? this.toTransaction(contact.tokenTransaction) : null,
    };
  }

  private toBalance(wallet: { id: string; userId: string; balance: number; createdAt: Date; updatedAt: Date }) {
    return {
      id: wallet.id,
      userId: wallet.userId,
      balance: wallet.balance,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }

  private toTransaction(transaction: {
    id: string;
    userId: string;
    type: TokenTransactionType;
    amount: number;
    balanceAfter: number;
    description: string;
    createdAt: Date;
  }) {
    return {
      id: transaction.id,
      userId: transaction.userId,
      type: transaction.type,
      amount: transaction.amount,
      balanceAfter: transaction.balanceAfter,
      description: transaction.description,
      createdAt: transaction.createdAt,
    };
  }

  private isPrismaError(error: unknown, code: string) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
  }
}
