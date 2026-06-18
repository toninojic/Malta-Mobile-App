import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { JobRequest, Notification, NotificationPreference, NotificationType, Prisma, UserRole, UserStatus } from '@prisma/client';
import { normalizeLocationKey } from '../common/malta-locations';
import { PaginatedResponse, PaginationQueryDto, paginationMeta } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { PushNotificationService } from '../push/push-notification.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { defaultNotificationPreferences } from './notification-preferences';

type NotificationCreateInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
};

const alertsWhere = (userId: string): Prisma.NotificationWhereInput => ({
  userId,
  type: { not: NotificationType.NEW_MESSAGE },
});

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushNotifications: PushNotificationService,
  ) {}

  async create(input: NotificationCreateInput, tx: Prisma.TransactionClient | PrismaService = this.prisma) {
    const notification = await tx.notification.create({
      data: input,
    });

    this.pushNotifications.queueNotification(notification);

    return this.toNotification(notification);
  }

  async createForAdmins(input: Omit<NotificationCreateInput, 'userId'>, tx: Prisma.TransactionClient | PrismaService = this.prisma) {
    const admins = await tx.user.findMany({
      where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
      select: { id: true },
    });

    const notifications = await Promise.all(
      admins.map((admin) =>
        tx.notification.create({
          data: {
            ...input,
            userId: admin.id,
          },
        }),
      ),
    );

    notifications.forEach((notification) => this.pushNotifications.queueNotification(notification));

    return notifications.map((notification) => this.toNotification(notification));
  }

  async notifyNewJobNearby(job: Pick<JobRequest, 'id' | 'title' | 'location' | 'category' | 'subcategory'>) {
    try {
      const locationKey = normalizeLocationKey(job.location);
      const matchingContractors = await this.prisma.user.findMany({
        where: {
          role: UserRole.CONTRACTOR,
          status: UserStatus.ACTIVE,
          OR: [
            { notificationPreference: null },
            { notificationPreference: { newJobsNearMe: true } },
          ],
          serviceLocations: {
            some: { locationKey },
          },
          serviceCategories: {
            some: {
              categoryKey: job.category,
              OR: [
                { subcategoryKey: null },
                { subcategoryKey: job.subcategory },
              ],
            },
          },
        },
        select: { id: true },
      });

      await Promise.all(
        matchingContractors.map((contractor) =>
          this.create({
            userId: contractor.id,
            type: NotificationType.NEW_JOB_NEARBY,
            title: 'New job near you',
            body: `${job.title} in ${job.location}`,
            data: {
              jobId: job.id,
              type: NotificationType.NEW_JOB_NEARBY,
              target: 'jobDetails',
            },
          }),
        ),
      );

      this.logDev('nearby job matching completed', {
        jobId: job.id,
        locationKey,
        category: job.category,
        subcategory: job.subcategory,
        matchedContractors: matchingContractors.length,
      });

      return { matchedContractors: matchingContractors.length };
    } catch (error) {
      this.logDevFailure('nearby job matching failed', error, { jobId: job.id });
      return { matchedContractors: 0 };
    }
  }

  async getPreferences(user: AuthenticatedUser) {
    try {
      const preference = await this.ensurePreferences(user.id, user.role);
      this.logDev('notification preferences loaded', { userId: user.id, role: user.role });
      return this.toPreference(preference);
    } catch (error) {
      this.logDevFailure('notification preferences load failed', error, { userId: user.id, role: user.role });
      throw error;
    }
  }

  async updatePreferences(user: AuthenticatedUser, dto: UpdateNotificationPreferencesDto) {
    try {
      const current = await this.ensurePreferences(user.id, user.role);
      const defaults = defaultNotificationPreferences(user.role);

      const data = {
        newJobsNearMe: user.role === UserRole.CONTRACTOR ? dto.newJobsNearMe : false,
        offerUpdates: dto.offerUpdates,
        messages: dto.messages,
        reviews: dto.reviews,
        paymentsRefunds: dto.paymentsRefunds,
        systemAlerts: dto.systemAlerts,
        adminAlerts: user.role === UserRole.ADMIN ? dto.adminAlerts : false,
      };

      const updated = await this.prisma.notificationPreference.update({
        where: { id: current.id },
        data: Object.fromEntries(
          Object.entries(data).filter(([, value]) => value !== undefined),
        ),
      });

      this.logDev('notification preferences saved', { userId: user.id, role: user.role });

      return this.toPreference({
        ...updated,
        newJobsNearMe: user.role === UserRole.CONTRACTOR ? updated.newJobsNearMe : defaults.newJobsNearMe,
        adminAlerts: user.role === UserRole.ADMIN ? updated.adminAlerts : defaults.adminAlerts,
      });
    } catch (error) {
      this.logDevFailure('notification preferences save failed', error, { userId: user.id, role: user.role });
      throw error;
    }
  }

  async findMine(
    user: AuthenticatedUser,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<ReturnType<NotificationsService['toNotification']>>> {
    const where = alertsWhere(user.id);

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
        type: { not: NotificationType.NEW_MESSAGE },
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
        type: { not: NotificationType.NEW_MESSAGE },
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { success: true };
  }

  private ensurePreferences(userId: string, role: UserRole) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        ...defaultNotificationPreferences(role),
      },
      update: {},
    });
  }

  private toPreference(preference: NotificationPreference) {
    return {
      id: preference.id,
      userId: preference.userId,
      newJobsNearMe: preference.newJobsNearMe,
      offerUpdates: preference.offerUpdates,
      messages: preference.messages,
      reviews: preference.reviews,
      paymentsRefunds: preference.paymentsRefunds,
      systemAlerts: preference.systemAlerts,
      adminAlerts: preference.adminAlerts,
      createdAt: preference.createdAt,
      updatedAt: preference.updatedAt,
    };
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

  private logDev(message: string, metadata: Record<string, unknown>) {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    this.logger.debug(`${message} ${JSON.stringify(metadata)}`);
  }

  private logDevFailure(message: string, error: unknown, metadata: Record<string, unknown>) {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    this.logger.warn(
      `${message} ${JSON.stringify({
        ...metadata,
        error: error instanceof Error ? error.message : String(error),
      })}`,
    );
  }
}
