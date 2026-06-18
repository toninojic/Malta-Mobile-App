import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Notification, NotificationType, Prisma, UserRole } from '@prisma/client';
import { PaginatedResponse, PaginationQueryDto, paginationMeta } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { isNotificationEnabled } from '../notifications/notification-preferences';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

type ExpoTicket = {
  status?: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: {
    error?: string;
  };
};

type ExpoPushMessage = {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data: Record<string, unknown>;
  channelId: 'messages' | 'marketplace' | 'system';
};

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private readonly expoPushUrl = 'https://exp.host/--/api/v2/push/send';

  constructor(private readonly prisma: PrismaService) {}

  async register(user: AuthenticatedUser, dto: RegisterPushTokenDto) {
    this.logPushDebug('push token upsert started', {
      userId: user.id,
      platform: dto.platform,
      deviceId: dto.deviceId,
      tokenPrefix: dto.expoPushToken.slice(0, 18),
    });

    const token = await this.prisma.pushToken.upsert({
      where: { expoPushToken: dto.expoPushToken },
      create: {
        userId: user.id,
        expoPushToken: dto.expoPushToken,
        platform: dto.platform,
        deviceId: dto.deviceId,
        deviceName: dto.deviceName,
        isActive: true,
        lastUsedAt: new Date(),
      },
      update: {
        userId: user.id,
        platform: dto.platform,
        deviceId: dto.deviceId,
        deviceName: dto.deviceName,
        isActive: true,
        lastUsedAt: new Date(),
      },
    });

    this.logPushDebug('push token upsert completed', {
      userId: user.id,
      pushTokenId: token.id,
      isActive: token.isActive,
      lastUsedAt: token.lastUsedAt.toISOString(),
      tokenPrefix: token.expoPushToken.slice(0, 18),
    });

    return this.toPushToken(token);
  }

  async mine(user: AuthenticatedUser) {
    const tokens = await this.prisma.pushToken.findMany({
      where: { userId: user.id },
      orderBy: { lastUsedAt: 'desc' },
    });

    return tokens.map((token) => this.toPushToken(token));
  }

  async deactivateMine(user: AuthenticatedUser, id: string) {
    const token = await this.prisma.pushToken.findUnique({ where: { id } });

    if (!token) {
      throw new NotFoundException('Push token not found.');
    }

    if (token.userId !== user.id) {
      throw new ForbiddenException('You can manage only your own push tokens.');
    }

    const updated = await this.prisma.pushToken.update({
      where: { id },
      data: { isActive: false },
    });

    return this.toPushToken(updated);
  }

  async adminFindAll(query: PaginationQueryDto): Promise<PaginatedResponse<ReturnType<PushNotificationService['toPushToken']>>> {
    const [tokens, total] = await this.prisma.$transaction([
      this.prisma.pushToken.findMany({
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.pushToken.count(),
    ]);

    return {
      data: tokens.map((token) => this.toPushToken(token)),
      pagination: paginationMeta(query.page, query.limit, total),
    };
  }

  async debugMine(user: AuthenticatedUser) {
    const tokens = await this.prisma.pushToken.findMany({
      where: { userId: user.id },
      orderBy: { lastUsedAt: 'desc' },
    });

    this.logPushDebug('debug push tokens requested', {
      userId: user.id,
      tokenCount: tokens.length,
      activeTokenCount: tokens.filter((token) => token.isActive).length,
    });

    return {
      userId: user.id,
      count: tokens.length,
      activeCount: tokens.filter((token) => token.isActive).length,
      tokens: tokens.map((token) => this.toPushToken(token)),
    };
  }

  async sendDebugTest(user: AuthenticatedUser) {
    const tokens = await this.prisma.pushToken.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { lastUsedAt: 'desc' },
      select: { id: true, expoPushToken: true },
    });

    this.logPushDebug('debug test push requested', {
      userId: user.id,
      activeTokenCount: tokens.length,
    });

    if (!tokens.length) {
      return {
        userId: user.id,
        sent: 0,
        tokenCount: 0,
        tickets: [],
        message: 'No active push tokens are saved for this user.',
      };
    }

    const messages = tokens.map((token) => ({
      to: token.expoPushToken,
      sound: 'default' as const,
      title: 'MaltaPro test push',
      body: 'Your device is registered for push notifications.',
      data: {
        type: NotificationType.SYSTEM_ALERT,
        target: 'notifications',
      },
      channelId: 'system' as const,
    }));

    const tickets = await this.sendExpoMessagesWithResult(messages);
    const sent = tickets.filter((ticket) => ticket.status === 'ok').length;

    this.logPushDebug('debug test push completed', {
      userId: user.id,
      sent,
      ticketCount: tickets.length,
      errors: tickets.filter((ticket) => ticket.status === 'error').map((ticket) => ticket.details?.error ?? ticket.message ?? 'unknown'),
    });

    return {
      userId: user.id,
      sent,
      tokenCount: tokens.length,
      tokens: tokens.map((token) => ({
        id: token.id,
        tokenPrefix: token.expoPushToken.slice(0, 18),
      })),
      tickets,
    };
  }

  queueNotification(notification: Notification) {
    setTimeout(() => {
      void this.sendForNotification(notification);
    }, 0);
  }

  async sendForNotification(notification: Notification) {
    await this.sendToUser({
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      body: this.pushBody(notification),
      data: this.notificationData(notification),
    });
  }

  async sendToUser(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Prisma.JsonValue | Prisma.InputJsonValue | Record<string, unknown> | null;
  }) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          role: true,
          status: true,
          notificationPreference: true,
          pushTokens: {
            where: { isActive: true },
            select: { id: true, expoPushToken: true },
          },
        },
      });

      if (!user || user.status !== 'ACTIVE') {
        return { sent: 0, skipped: true };
      }

      if (!isNotificationEnabled(user.role, user.notificationPreference, input.type)) {
        return { sent: 0, skipped: true };
      }

      if (!user.pushTokens.length) {
        return { sent: 0, skipped: true };
      }

      const messages = user.pushTokens.map((token) => ({
        to: token.expoPushToken,
        sound: 'default' as const,
        title: input.title,
        body: input.body,
        data: this.safePushData({ ...(this.objectData(input.data) ?? {}), type: input.type }),
        channelId: this.channelForType(input.type),
      }));

      await this.sendExpoMessages(messages);
      return { sent: messages.length, skipped: false };
    } catch (error) {
      this.logger.warn(`Push send failed for user=${input.userId} type=${input.type}: ${this.errorMessage(error)}`);
      return { sent: 0, skipped: true };
    }
  }

  async sendToAdmins(input: {
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }) {
    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN, status: 'ACTIVE' },
      select: { id: true },
    });

    await Promise.all(
      admins.map((admin) =>
        this.sendToUser({
          userId: admin.id,
          type: input.type,
          title: input.title,
          body: input.body,
          data: input.data,
        }),
      ),
    );
  }

  private async sendExpoMessages(messages: ExpoPushMessage[]) {
    await this.sendExpoMessagesWithResult(messages);
  }

  private async sendExpoMessagesWithResult(messages: ExpoPushMessage[]) {
    const allTickets: ExpoTicket[] = [];

    for (let index = 0; index < messages.length; index += 100) {
      const chunk = messages.slice(index, index + 100);
      const response = await fetch(this.expoPushUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      const payload = (await response.json().catch(() => null)) as { data?: ExpoTicket[] } | null;

      if (!response.ok) {
        this.logger.warn(`Expo push API returned ${response.status}`);
        allTickets.push(
          ...chunk.map(() => ({
            status: 'error' as const,
            message: `Expo push API returned ${response.status}`,
          })),
        );
        continue;
      }

      const tickets = payload?.data ?? [];
      allTickets.push(...tickets);
      await this.handleExpoTickets(chunk, tickets);
    }

    return allTickets;
  }

  private async handleExpoTickets(messages: ExpoPushMessage[], tickets: ExpoTicket[]) {
    await Promise.all(
      tickets.map(async (ticket, index) => {
        if (ticket.status !== 'error') {
          return;
        }

        const token = messages[index]?.to;
        const errorCode = ticket.details?.error;
        this.logger.warn(`Expo push ticket error token=${token ?? 'unknown'} error=${errorCode ?? ticket.message ?? 'unknown'}`);

        if (token && ['DeviceNotRegistered', 'InvalidCredentials'].includes(errorCode ?? '')) {
          await this.prisma.pushToken.updateMany({
            where: { expoPushToken: token },
            data: { isActive: false },
          });
        }
      }),
    );
  }

  private pushBody(notification: Notification) {
    if (notification.type === NotificationType.NEW_MESSAGE) {
      return 'You have a new message';
    }

    return notification.body;
  }

  private notificationData(notification: Notification) {
    return this.safePushData({
      ...(this.objectData(notification.data) ?? {}),
      notificationId: notification.id,
      type: notification.type,
    });
  }

  private channelForType(type: NotificationType): ExpoPushMessage['channelId'] {
    if (type === NotificationType.NEW_MESSAGE) {
      return 'messages';
    }

    if (
      type === NotificationType.SYSTEM_ALERT ||
      type === NotificationType.ACCOUNT_ACTIVATED ||
      type === NotificationType.ACCOUNT_SUSPENDED ||
      type === NotificationType.NEW_REPORT ||
      type === NotificationType.NEW_VERIFICATION_REQUEST ||
      type === NotificationType.NEW_REFUND_REQUEST
    ) {
      return 'system';
    }

    return 'marketplace';
  }

  private objectData(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
  }

  private safePushData(data: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(data).filter(([, value]) =>
        value === null ||
        ['string', 'number', 'boolean'].includes(typeof value),
      ),
    );
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  private logPushDebug(message: string, metadata: Record<string, unknown>) {
    if (process.env.PUSH_DEBUG !== 'true' && process.env.NODE_ENV === 'production') {
      return;
    }

    this.logger.debug(`${message} ${JSON.stringify(metadata)}`);
  }

  private toPushToken(token: {
    id: string;
    userId: string;
    expoPushToken: string;
    platform: string;
    deviceId: string | null;
    deviceName: string | null;
    isActive: boolean;
    lastUsedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: token.id,
      userId: token.userId,
      expoPushToken: token.expoPushToken,
      platform: token.platform,
      deviceId: token.deviceId,
      deviceName: token.deviceName,
      isActive: token.isActive,
      lastUsedAt: token.lastUsedAt,
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
    };
  }
}
