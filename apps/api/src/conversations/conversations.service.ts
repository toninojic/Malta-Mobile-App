import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ContactUnlockStatus, Prisma, UserRole } from '@prisma/client';
import { PaginatedResponse, PaginationQueryDto, paginationMeta } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';

const conversationInclude = {
  contactUnlock: {
    include: {
      jobRequest: true,
      offer: true,
    },
  },
  employer: {
    select: {
      id: true,
      email: true,
      profile: true,
    },
  },
  contractor: {
    select: {
      id: true,
      email: true,
      profile: true,
    },
  },
  messages: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    include: {
      sender: {
        select: {
          id: true,
          email: true,
          profile: true,
        },
      },
    },
  },
};

type ConversationWithRelations = Prisma.ConversationGetPayload<{ include: typeof conversationInclude }>;

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMine(
    user: AuthenticatedUser,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<Awaited<ReturnType<ConversationsService['toConversation']>>>> {
    const where = this.whereForUser(user);

    const [conversations, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where,
        include: conversationInclude,
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return {
      data: await Promise.all(conversations.map((conversation) => this.toConversation(conversation, user.id))),
      pagination: paginationMeta(query.page, query.limit, total),
    };
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: conversationInclude,
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }

    this.assertCanView(user, conversation);
    return this.toConversation(conversation, user.id);
  }

  async ensureForContact(user: AuthenticatedUser, contactUnlockId: string) {
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Admins can view conversations but cannot create participant conversations.');
    }

    const contactUnlock = await this.prisma.contactUnlock.findUnique({
      where: { id: contactUnlockId },
      include: {
        jobRequest: true,
        offer: true,
      },
    });

    if (!contactUnlock || contactUnlock.status !== ContactUnlockStatus.UNLOCKED) {
      throw new NotFoundException('Unlocked contact relationship not found.');
    }

    if (contactUnlock.employerId !== user.id && contactUnlock.contractorId !== user.id) {
      throw new ForbiddenException('You cannot open conversations outside your unlocked relationships.');
    }

    const conversation = await this.prisma.conversation.upsert({
      where: { contactUnlockId },
      create: {
        contactUnlockId,
        employerId: contactUnlock.employerId,
        contractorId: contactUnlock.contractorId,
      },
      update: {},
      include: conversationInclude,
    });

    return this.toConversation(conversation, user.id);
  }

  async findAll(query: PaginationQueryDto): Promise<PaginatedResponse<Awaited<ReturnType<ConversationsService['toConversation']>>>> {
    const [conversations, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        include: conversationInclude,
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.conversation.count(),
    ]);

    return {
      data: await Promise.all(conversations.map((conversation) => this.toConversation(conversation, ''))),
      pagination: paginationMeta(query.page, query.limit, total),
    };
  }

  async findAdminOne(id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: conversationInclude,
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId: id,
        deletedAt: null,
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      ...(await this.toConversation(conversation, '')),
      messages: messages.map((message) => this.toMessage(message)),
    };
  }

  async findAdminMessages(id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId: id,
        deletedAt: null,
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return messages.map((message) => this.toMessage(message));
  }

  private whereForUser(user: AuthenticatedUser): Prisma.ConversationWhereInput {
    return user.role === UserRole.EMPLOYER
      ? { employerId: user.id }
      : user.role === UserRole.CONTRACTOR
        ? { contractorId: user.id }
        : {};
  }

  private assertCanView(user: AuthenticatedUser, conversation: Pick<ConversationWithRelations, 'employerId' | 'contractorId'>) {
    if (conversation.employerId === user.id || conversation.contractorId === user.id) {
      return;
    }

    throw new ForbiddenException('You cannot access this conversation.');
  }

  private async toConversation(conversation: ConversationWithRelations, viewerId: string) {
    const unreadCount = viewerId
      ? await this.prisma.message.count({
          where: {
            conversationId: conversation.id,
            senderId: { not: viewerId },
            isRead: false,
            deletedAt: null,
          },
        })
      : await this.prisma.message.count({
          where: {
            conversationId: conversation.id,
            isRead: false,
            deletedAt: null,
          },
        });

    const lastMessage = conversation.messages[0];

    return {
      id: conversation.id,
      contactUnlockId: conversation.contactUnlockId,
      employerId: conversation.employerId,
      contractorId: conversation.contractorId,
      lastMessageAt: conversation.lastMessageAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      contactUnlock: {
        id: conversation.contactUnlock.id,
        jobRequestId: conversation.contactUnlock.jobRequestId,
        offerId: conversation.contactUnlock.offerId,
        status: conversation.contactUnlock.status,
        jobRequest: conversation.contactUnlock.jobRequest,
        offer: {
          id: conversation.contactUnlock.offer.id,
          estimatedPrice: conversation.contactUnlock.offer.estimatedPrice.toString(),
          estimatedCompletionDays: conversation.contactUnlock.offer.estimatedCompletionDays,
          message: conversation.contactUnlock.offer.message,
        },
      },
      employer: conversation.employer,
      contractor: conversation.contractor,
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            conversationId: lastMessage.conversationId,
            senderId: lastMessage.senderId,
            content: lastMessage.content,
            isRead: lastMessage.isRead,
            createdAt: lastMessage.createdAt,
            updatedAt: lastMessage.updatedAt,
            sender: lastMessage.sender,
          }
        : null,
      unreadCount,
    };
  }

  private toMessage(message: {
    id: string;
    conversationId: string | null;
    senderId: string;
    content: string;
    isRead: boolean;
    createdAt: Date;
    updatedAt: Date;
    sender?: unknown;
  }) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      isRead: message.isRead,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      sender: message.sender,
    };
  }
}
