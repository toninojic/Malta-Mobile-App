import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Notification, NotificationType, Prisma } from '@prisma/client';
import { PaginatedResponse, PaginationQueryDto, paginationMeta } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';

type NotificationCreateInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: NotificationCreateInput, tx: Prisma.TransactionClient | PrismaService = this.prisma) {
    const notification = await tx.notification.create({
      data: input,
    });

    return this.toNotification(notification);
  }

  async findMine(
    user: AuthenticatedUser,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<ReturnType<NotificationsService['toNotification']>>> {
    const where: Prisma.NotificationWhereInput = { userId: user.id };

    const [notifications, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications.map((notification) => this.toNotification(notification)),
      pagination: paginationMeta(query.page, query.limit, total),
    };
  }

  async findAll(query: PaginationQueryDto): Promise<PaginatedResponse<ReturnType<NotificationsService['toNotification']>>> {
    const [notifications, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.notification.count(),
    ]);

    return {
      data: notifications.map((notification) => this.toNotification(notification)),
      pagination: paginationMeta(query.page, query.limit, total),
    };
  }

  async unreadCount(user: AuthenticatedUser) {
    const count = await this.prisma.notification.count({
      where: {
        userId: user.id,
        isRead: false,
      },
    });

    return { count };
  }

  async markRead(user: AuthenticatedUser, id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }

    if (notification.userId !== user.id) {
      throw new ForbiddenException('You can mark only your own notifications as read.');
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: notification.readAt ?? new Date(),
      },
    });

    return this.toNotification(updated);
  }

  async markAllRead(user: AuthenticatedUser) {
    await this.prisma.notification.updateMany({
      where: {
        userId: user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { success: true };
  }

  private toNotification(notification: Notification) {
    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      metadata: notification.data,
      isRead: notification.isRead,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }
}
