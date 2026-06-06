import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContactUnlockStatus, Message, NotificationType, Prisma, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';

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
};

const messageInclude = {
  sender: {
    select: {
      id: true,
      email: true,
      profile: true,
    },
  },
};

type ConversationWithRelations = Prisma.ConversationGetPayload<{ include: typeof conversationInclude }>;
type MessageWithSender = Prisma.MessageGetPayload<{ include: typeof messageInclude }>;

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async sendMessage(user: AuthenticatedUser, conversationOrContactId: string, dto: SendMessageDto) {
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Admins can view conversations but cannot send participant messages.');
    }

    const content = this.sanitize(dto.content);
    if (!content) {
      throw new BadRequestException('Message content cannot be empty.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const conversation = await this.getOrCreateConversation(tx, user, conversationOrContactId);
      const recipientId = conversation.employerId === user.id ? conversation.contractorId : conversation.employerId;

      const message = await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderId: user.id,
          content,
          isRead: false,
        },
        include: messageInclude,
      });

      await tx.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: message.createdAt },
      });

      await this.notificationsService.create(
        {
          userId: recipientId,
          type: NotificationType.NEW_MESSAGE,
          title: 'New message',
          body: content.length > 120 ? `${content.slice(0, 117)}...` : content,
          data: {
            conversationId: conversation.id,
            messageId: message.id,
            contactUnlockId: conversation.contactUnlockId,
          },
        },
        tx,
      );

      return { conversation, message };
    });

    return {
      conversation: await this.toConversation(result.conversation, user.id),
      message: this.toMessage(result.message),
    };
  }

  async findConversationMessages(user: AuthenticatedUser, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: conversationInclude,
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }

    this.assertParticipant(user, conversation);

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        deletedAt: null,
      },
      include: messageInclude,
      orderBy: { createdAt: 'asc' },
    });

    return messages.map((message) => this.toMessage(message));
  }

  async markRead(user: AuthenticatedUser, messageId: string) {
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Admins cannot update participant message read state.');
    }

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: true,
        sender: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
      },
    });

    if (!message || !message.conversation || message.deletedAt) {
      throw new NotFoundException('Message not found.');
    }

    this.assertParticipant(user, message.conversation);

    if (message.senderId === user.id) {
      throw new ForbiddenException('Only the recipient can mark a message as read.');
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { isRead: true },
      include: messageInclude,
    });

    return this.toMessage(updated);
  }

  private async getOrCreateConversation(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    conversationOrContactId: string,
  ) {
    const existingConversation = await tx.conversation.findUnique({
      where: { id: conversationOrContactId },
      include: conversationInclude,
    });

    if (existingConversation) {
      this.assertParticipant(user, existingConversation);
      return existingConversation;
    }

    const contactUnlock = await tx.contactUnlock.findUnique({
      where: { id: conversationOrContactId },
      include: {
        jobRequest: true,
        offer: true,
      },
    });

    if (!contactUnlock) {
      throw new NotFoundException('Conversation not found.');
    }

    if (contactUnlock.status !== ContactUnlockStatus.UNLOCKED) {
      throw new ForbiddenException('Messages can be sent only after contact unlock.');
    }

    if (contactUnlock.employerId !== user.id && contactUnlock.contractorId !== user.id) {
      throw new ForbiddenException('You cannot message outside your unlocked relationships.');
    }

    try {
      return await tx.conversation.upsert({
        where: { contactUnlockId: contactUnlock.id },
        create: {
          contactUnlockId: contactUnlock.id,
          employerId: contactUnlock.employerId,
          contractorId: contactUnlock.contractorId,
        },
        update: {},
        include: conversationInclude,
      });
    } catch (error) {
      if (this.isPrismaError(error, 'P2002')) {
        throw new ConflictException('Conversation already exists for this contact unlock.');
      }

      throw error;
    }
  }

  private assertParticipant(
    user: AuthenticatedUser,
    conversation: Pick<ConversationWithRelations, 'employerId' | 'contractorId'>,
  ) {
    if (user.role === UserRole.ADMIN) {
      return;
    }

    if (conversation.employerId === user.id || conversation.contractorId === user.id) {
      return;
    }

    throw new ForbiddenException('You cannot access this conversation.');
  }

  private sanitize(content: string) {
    return content.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  }

  private async toConversation(conversation: ConversationWithRelations, viewerId: string) {
    const [lastMessage, unreadCount] = await Promise.all([
      this.prisma.message.findFirst({
        where: {
          conversationId: conversation.id,
          deletedAt: null,
        },
        include: messageInclude,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.message.count({
        where: {
          conversationId: conversation.id,
          senderId: { not: viewerId },
          isRead: false,
          deletedAt: null,
        },
      }),
    ]);

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
          startDate: conversation.contactUnlock.offer.startDate,
          estimatedCompletionDays: conversation.contactUnlock.offer.estimatedCompletionDays,
          message: conversation.contactUnlock.offer.message,
        },
      },
      employer: conversation.employer,
      contractor: conversation.contractor,
      lastMessage: lastMessage ? this.toMessage(lastMessage) : null,
      unreadCount,
    };
  }

  private toMessage(message: Message | MessageWithSender) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      isRead: message.isRead,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      sender: 'sender' in message ? message.sender : undefined,
    };
  }

  private isPrismaError(error: unknown, code: string) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
  }
}
