import { Injectable } from '@nestjs/common';
import { AnalyticsEvent, Prisma, UserRole } from '@prisma/client';
import { paginationMeta } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAnalyticsQueryDto } from './dto/admin-analytics-query.dto';
import { CreateAnalyticsEventDto } from './dto/create-analytics-event.dto';

const EMPLOYER_FUNNEL = [
  'REGISTER_VIEWED',
  'EMPLOYER_REGISTER_COMPLETED',
  'CREATE_JOB_VIEWED',
  'JOB_CREATED',
  'OFFER_SELECTED',
  'COMPLETION_CONFIRMED',
  'CONTRACTOR_REVIEW_LEFT',
];

const CONTRACTOR_FUNNEL = [
  'REGISTER_VIEWED',
  'CONTRACTOR_REGISTER_COMPLETED',
  'ONBOARDING_COMPLETED',
  'JOB_DETAILS_VIEWED',
  'OFFER_CREATED',
  'CONTACT_UNLOCKED',
  'JOB_MARKED_COMPLETED',
  'EMPLOYER_REVIEW_LEFT',
];

const FAILURE_EVENTS = [
  'API_ERROR',
  'VALIDATION_ERROR',
  'PUSH_REGISTRATION_FAILED',
  'DEEP_LINK_FAILED',
  'JOB_CREATE_FAILED',
  'OFFER_CREATE_FAILED',
  'CONTACT_UNLOCK_FAILED',
  'MESSAGE_SEND_FAILED',
  'TOKEN_PURCHASE_FAILED',
  'REPORT_FAILED',
  'GOOGLE_LOGIN_FAILED',
  'EMAIL_VERIFY_FAILED',
];

const SENSITIVE_METADATA_KEY = /(password|token|secret|authorization|credential|message|body|description|content|phone|email|contact|whatsapp|viber|telegram|url|link|document|verification|avatar|image|file)/i;

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthenticatedUser | null, dto: CreateAnalyticsEventDto) {
    const event = await this.prisma.analyticsEvent.create({
      data: this.eventCreateData(user, dto),
    });

    return this.toEvent(event);
  }

  async createBatch(user: AuthenticatedUser | null, events: CreateAnalyticsEventDto[]) {
    const sanitizedEvents = events.slice(0, 50).map((event) => this.eventCreateData(user, event));
    if (!sanitizedEvents.length) {
      return { created: 0 };
    }

    const result = await this.prisma.analyticsEvent.createMany({
      data: sanitizedEvents,
    });

    return { created: result.count };
  }

  async overview(query: AdminAnalyticsQueryDto) {
    const where = this.whereFromQuery(query);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      activeUsers24h,
      activeUsers7d,
      totalEvents,
      mostViewedScreens,
      topActions,
      topFailures,
    ] = await Promise.all([
      this.activeUsers({ ...where, createdAt: { gte: since24h } }),
      this.activeUsers({ ...where, createdAt: { gte: since7d } }),
      this.prisma.analyticsEvent.count({ where }),
      this.prisma.analyticsEvent.groupBy({
        by: ['screen'],
        where,
        _count: { _all: true },
        orderBy: { _count: { screen: 'desc' } },
        take: 10,
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['eventName'],
        where,
        _count: { _all: true },
        orderBy: { _count: { eventName: 'desc' } },
        take: 10,
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['eventName'],
        where: this.failureWhere(where),
        _count: { _all: true },
        orderBy: { _count: { eventName: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      activeUsers: {
        last24h: activeUsers24h,
        last7d: activeUsers7d,
      },
      totalEvents,
      mostViewedScreens: mostViewedScreens.map((item) => ({ screen: item.screen, count: item._count._all })),
      topActions: topActions.map((item) => ({ eventName: item.eventName, count: item._count._all })),
      topFailures: topFailures.map((item) => ({ eventName: item.eventName, count: item._count._all })),
    };
  }

  async events(query: AdminAnalyticsQueryDto) {
    const where = this.whereFromQuery(query);
    const [events, total] = await this.prisma.$transaction([
      this.prisma.analyticsEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.analyticsEvent.count({ where }),
    ]);

    return {
      data: events.map((event) => this.toEvent(event)),
      pagination: paginationMeta(query.page, query.limit, total),
    };
  }

  async funnels(query: AdminAnalyticsQueryDto) {
    const where = this.whereFromQuery(query);
    const employer = await this.countFunnel(EMPLOYER_FUNNEL, { ...where, role: UserRole.EMPLOYER });
    const contractor = await this.countFunnel(CONTRACTOR_FUNNEL, { ...where, role: UserRole.CONTRACTOR });

    return { employer, contractor };
  }

  async errors(query: AdminAnalyticsQueryDto) {
    const where = this.failureWhere(this.whereFromQuery(query));
    const [byEvent, byScreen, counts] = await Promise.all([
      this.prisma.analyticsEvent.groupBy({
        by: ['eventName'],
        where,
        _count: { _all: true },
        orderBy: { _count: { eventName: 'desc' } },
        take: 20,
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['screen'],
        where,
        _count: { _all: true },
        orderBy: { _count: { screen: 'desc' } },
        take: 20,
      }),
      Promise.all([
        this.failureCount('OFFER_CREATE_FAILED', query),
        this.failureCount('JOB_CREATE_FAILED', query),
        this.failureCount('CONTACT_UNLOCK_FAILED', query),
        this.failureCount('GOOGLE_LOGIN_FAILED', query),
        this.failureCount('EMAIL_VERIFY_FAILED', query),
      ]),
    ]);

    return {
      byEvent: byEvent.map((item) => ({ eventName: item.eventName, count: item._count._all })),
      byScreen: byScreen.map((item) => ({ screen: item.screen, count: item._count._all })),
      counts: {
        failedOfferCreation: counts[0],
        failedJobCreation: counts[1],
        failedUnlock: counts[2],
        failedGoogleLogin: counts[3],
        failedEmailVerification: counts[4],
      },
    };
  }

  private eventCreateData(user: AuthenticatedUser | null, dto: CreateAnalyticsEventDto): Prisma.AnalyticsEventCreateManyInput {
    return {
      userId: user?.id,
      role: user?.role,
      sessionId: dto.sessionId.trim(),
      eventName: this.normalizeLabel(dto.eventName),
      screen: this.normalizeLabel(dto.screen),
      entityType: dto.entityType,
      entityId: dto.entityId?.trim(),
      metadata: dto.metadata ? sanitizeMetadata(dto.metadata) : undefined,
      platform: dto.platform.trim().slice(0, 40),
      appVersion: dto.appVersion?.trim().slice(0, 40),
    };
  }

  private normalizeLabel(value: string) {
    return value.trim().replace(/\s+/g, '_').toUpperCase().slice(0, 120);
  }

  private whereFromQuery(query: AdminAnalyticsQueryDto): Prisma.AnalyticsEventWhereInput {
    return {
      ...(query.role ? { role: query.role } : {}),
      ...(query.eventName ? { eventName: this.normalizeLabel(query.eventName) } : {}),
      ...(query.screen ? { screen: this.normalizeLabel(query.screen) } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
  }

  private failureWhere(where: Prisma.AnalyticsEventWhereInput): Prisma.AnalyticsEventWhereInput {
    return {
      ...where,
      OR: [
        { eventName: { in: FAILURE_EVENTS } },
        { eventName: { endsWith: '_FAILED' } },
        { eventName: { contains: 'ERROR' } },
      ],
    };
  }

  private async activeUsers(where: Prisma.AnalyticsEventWhereInput) {
    const users = await this.prisma.analyticsEvent.findMany({
      where: {
        ...where,
        userId: { not: null },
      },
      distinct: ['userId'],
      select: { userId: true },
    });
    return users.length;
  }

  private async countFunnel(steps: string[], where: Prisma.AnalyticsEventWhereInput) {
    const groups = await this.prisma.analyticsEvent.groupBy({
      by: ['eventName'],
      where: {
        ...where,
        eventName: { in: steps },
      },
      _count: { _all: true },
    });
    const counts = new Map(groups.map((group) => [group.eventName, group._count._all]));
    return steps.map((eventName) => ({ eventName, count: counts.get(eventName) ?? 0 }));
  }

  private async failureCount(eventName: string, query: AdminAnalyticsQueryDto) {
    return this.prisma.analyticsEvent.count({
      where: {
        ...this.whereFromQuery(query),
        eventName,
      },
    });
  }

  private toEvent(event: AnalyticsEvent) {
    return {
      id: event.id,
      userId: event.userId,
      role: event.role,
      sessionId: event.sessionId,
      eventName: event.eventName,
      screen: event.screen,
      entityType: event.entityType,
      entityId: event.entityId,
      metadata: event.metadata,
      platform: event.platform,
      appVersion: event.appVersion,
      createdAt: event.createdAt,
    };
  }
}

function sanitizeMetadata(value: unknown, depth = 0): Prisma.InputJsonValue {
  if (depth > 4) {
    return '[truncated]';
  }

  if (value === null) {
    return 'null';
  }

  if (typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return value.slice(0, 200);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeMetadata(item, depth + 1));
  }

  if (typeof value === 'object') {
    const output: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, item] of Object.entries(value).slice(0, 30)) {
      output[key.slice(0, 80)] = SENSITIVE_METADATA_KEY.test(key)
        ? '[redacted]'
        : sanitizeMetadata(item, depth + 1);
    }
    return output;
  }

  return String(value).slice(0, 120);
}
