import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  JobStatus,
  NotificationType,
  OfferRejectionReason,
  OfferStatus,
  Prisma,
  Report,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  ReviewStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { paginationMeta } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportsQueryDto } from './dto/reports-query.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';

const reportInclude = {
  reporter: {
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      profile: true,
    },
  },
  reviewedByAdmin: {
    select: {
      id: true,
      email: true,
      profile: true,
    },
  },
};

type ReportWithRelations = Prisma.ReportGetPayload<{ include: typeof reportInclude }>;
type TargetSummary = {
  title: string;
  subtitle?: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateReportDto) {
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Suspended users cannot create reports.');
    }

    const description = this.cleanOptional(dto.description);
    if (dto.reason === ReportReason.OTHER && !description) {
      throw new BadRequestException('Description is required when reason is Other.');
    }

    await this.assertReportTargetAllowed(user, dto.targetType, dto.targetId);
    await this.assertRateLimit(user.id);
    await this.assertNoDuplicatePendingReport(user.id, dto.targetType, dto.targetId);

    const report = await this.prisma.$transaction(async (tx) => {
      const created = await tx.report.create({
        data: {
          reporterId: user.id,
          targetType: dto.targetType,
          targetId: dto.targetId,
          reason: dto.reason,
          description,
        },
        include: reportInclude,
      });

      await this.notificationsService.createForAdmins(
        {
          type: NotificationType.NEW_REPORT,
          title: 'New report submitted',
          body: `${user.email} submitted a ${dto.reason.toLowerCase().replace(/_/g, ' ')} report.`,
          data: {
            reportId: created.id,
            targetType: created.targetType,
            targetId: created.targetId,
            reason: created.reason,
            target: 'adminReports',
          },
        },
        tx,
      );

      return created;
    });

    return this.toReport(report, { includeReporter: false });
  }

  async findMine(user: AuthenticatedUser, query: ReportsQueryDto) {
    const where: Prisma.ReportWhereInput = {
      ...this.filterWhere(query),
      reporterId: user.id,
    };

    const [reports, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        include: reportInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      data: await Promise.all(reports.map((report) => this.toReport(report, { includeReporter: false }))),
      pagination: paginationMeta(query.page, query.limit, total),
    };
  }

  async findMineOne(user: AuthenticatedUser, reportId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: reportInclude,
    });

    if (!report) {
      throw new NotFoundException('Report not found.');
    }

    if (report.reporterId !== user.id) {
      throw new ForbiddenException('You can view only your own reports.');
    }

    return this.toReport(report, { includeReporter: false });
  }

  async findAdminAll(query: ReportsQueryDto) {
    const where: Prisma.ReportWhereInput = this.filterWhere(query);

    const [reports, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        include: reportInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      data: await Promise.all(
        reports.map((report) => this.toReport(report, { includeReporter: true, includeAdminTargetDetails: true })),
      ),
      pagination: paginationMeta(query.page, query.limit, total),
    };
  }

  async findAdminOne(reportId: string) {
    const report = await this.getReport(reportId);
    return this.toReport(report, { includeReporter: true, includeAdminTargetDetails: true });
  }

  async updateStatus(admin: AuthenticatedUser, reportId: string, dto: UpdateReportStatusDto) {
    const report = await this.getReport(reportId);
    const adminNote = this.cleanOptional(dto.adminNote);
    const reviewedAt =
      dto.status === ReportStatus.RESOLVED || dto.status === ReportStatus.DISMISSED ? new Date() : report.reviewedAt;

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.report.update({
        where: { id: report.id },
        data: {
          status: dto.status,
          adminNote,
          reviewedByAdminId: admin.id,
          reviewedAt,
        },
        include: reportInclude,
      });

      await this.auditLogsService.create(
        {
          adminId: admin.id,
          action: this.statusAuditAction(dto.status),
          entityType: 'Report',
          entityId: report.id,
          metadata: this.reportAuditMetadata(report, adminNote),
        },
        tx,
      );

      await this.notificationsService.create(
        {
          userId: report.reporterId,
          type: NotificationType.REPORT_STATUS_UPDATED,
          title: this.reportStatusTitle(dto.status),
          body: this.reportStatusBody(dto.status),
          data: {
            reportId: report.id,
            status: dto.status,
            target: 'myReports',
          },
        },
        tx,
      );

      return next;
    });

    return this.toReport(updated, { includeReporter: true, includeAdminTargetDetails: true });
  }

  async suspendUserFromReport(admin: AuthenticatedUser, reportId: string) {
    const report = await this.getReport(reportId);
    if (report.targetType !== ReportTargetType.USER) {
      throw new BadRequestException('This report does not target a user.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: report.targetId } });
    if (!user) {
      throw new NotFoundException('Reported user not found.');
    }
    if (user.id === admin.id) {
      throw new BadRequestException('Admins cannot suspend themselves.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          status: UserStatus.SUSPENDED,
          deactivatedAt: null,
        },
      });

      await this.auditLogsService.create(
        {
          adminId: admin.id,
          action: 'USER_SUSPENDED_FROM_REPORT',
          entityType: 'User',
          entityId: user.id,
          metadata: this.reportAuditMetadata(report),
        },
        tx,
      );

      await this.notificationsService.create(
        {
          userId: user.id,
          type: NotificationType.ACCOUNT_SUSPENDED,
          title: 'Account suspended',
          body: 'Your account has been suspended by an admin.',
          data: { reportId: report.id },
        },
        tx,
      );
    });

    return this.findAdminOne(report.id);
  }

  async activateUserFromReport(admin: AuthenticatedUser, reportId: string) {
    const report = await this.getReport(reportId);
    if (report.targetType !== ReportTargetType.USER) {
      throw new BadRequestException('This report does not target a user.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: report.targetId } });
    if (!user) {
      throw new NotFoundException('Reported user not found.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          status: UserStatus.ACTIVE,
          deactivatedAt: null,
        },
      });

      await this.auditLogsService.create(
        {
          adminId: admin.id,
          action: 'USER_ACTIVATED_FROM_REPORT',
          entityType: 'User',
          entityId: user.id,
          metadata: this.reportAuditMetadata(report),
        },
        tx,
      );

      await this.notificationsService.create(
        {
          userId: user.id,
          type: NotificationType.ACCOUNT_ACTIVATED,
          title: 'Account activated',
          body: 'Your account has been activated by an admin.',
          data: { reportId: report.id },
        },
        tx,
      );
    });

    return this.findAdminOne(report.id);
  }

  async closeJobFromReport(admin: AuthenticatedUser, reportId: string) {
    const report = await this.getReport(reportId);
    if (report.targetType !== ReportTargetType.JOB) {
      throw new BadRequestException('This report does not target a job.');
    }

    const job = await this.prisma.jobRequest.findUnique({ where: { id: report.targetId } });
    if (!job) {
      throw new NotFoundException('Reported job not found.');
    }
    if (job.status === JobStatus.COMPLETED) {
      throw new BadRequestException('Completed jobs cannot be closed by moderation.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.jobRequest.update({
        where: { id: job.id },
        data: { status: JobStatus.CLOSED },
      });

      await tx.offer.updateMany({
        where: {
          jobRequestId: job.id,
          status: { in: [OfferStatus.PENDING, OfferStatus.REJECTED] },
          deletedAt: null,
          OR: [
            { rejectionReason: null },
            { rejectionReason: OfferRejectionReason.AUTO_REJECTED_BY_SELECTION },
          ],
        },
        data: {
          status: OfferStatus.REJECTED,
          selectedByEmployer: false,
          rejectionReason: OfferRejectionReason.JOB_CLOSED,
        },
      });

      await this.auditLogsService.create(
        {
          adminId: admin.id,
          action: 'JOB_CLOSED_FROM_REPORT',
          entityType: 'JobRequest',
          entityId: job.id,
          metadata: this.reportAuditMetadata(report),
        },
        tx,
      );
    });

    return this.findAdminOne(report.id);
  }

  async removeReviewFromReport(admin: AuthenticatedUser, reportId: string) {
    const report = await this.getReport(reportId);
    if (report.targetType !== ReportTargetType.REVIEW) {
      throw new BadRequestException('This report does not target a review.');
    }

    const review = await this.prisma.review.findUnique({ where: { id: report.targetId } });
    if (review) {
      await this.prisma.$transaction(async (tx) => {
        await tx.review.update({
          where: { id: review.id },
          data: {
            status: ReviewStatus.REMOVED,
            removedAt: new Date(),
            removedByAdminId: admin.id,
          },
        });
        await this.recalculateContractorRating(tx, review.contractorId);
        await this.auditLogsService.create(
          {
            adminId: admin.id,
            action: 'REVIEW_REMOVED_FROM_REPORT',
            entityType: 'Review',
            entityId: review.id,
            metadata: this.reportAuditMetadata(report),
          },
          tx,
        );
      });
      return this.findAdminOne(report.id);
    }

    const employerReview = await this.prisma.employerReview.findUnique({ where: { id: report.targetId } });
    if (!employerReview) {
      throw new NotFoundException('Reported review not found.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.employerReview.update({
        where: { id: employerReview.id },
        data: {
          status: ReviewStatus.REMOVED,
          removedAt: new Date(),
          removedByAdminId: admin.id,
        },
      });
      await this.recalculateEmployerRating(tx, employerReview.employerId);
      await this.auditLogsService.create(
        {
          adminId: admin.id,
          action: 'REVIEW_REMOVED_FROM_REPORT',
          entityType: 'EmployerReview',
          entityId: employerReview.id,
          metadata: this.reportAuditMetadata(report),
        },
        tx,
      );
    });

    return this.findAdminOne(report.id);
  }

  async hideMessageFromReport(admin: AuthenticatedUser, reportId: string) {
    const report = await this.getReport(reportId);
    if (report.targetType !== ReportTargetType.MESSAGE) {
      throw new BadRequestException('This report does not target a message.');
    }

    const message = await this.prisma.message.findUnique({ where: { id: report.targetId } });
    if (!message) {
      throw new NotFoundException('Reported message not found.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.message.update({
        where: { id: message.id },
        data: { deletedAt: message.deletedAt ?? new Date() },
      });

      await this.auditLogsService.create(
        {
          adminId: admin.id,
          action: 'MESSAGE_HIDDEN_FROM_REPORT',
          entityType: 'Message',
          entityId: message.id,
          metadata: this.reportAuditMetadata(report),
        },
        tx,
      );
    });

    return this.findAdminOne(report.id);
  }

  private async assertReportTargetAllowed(user: AuthenticatedUser, targetType: ReportTargetType, targetId: string) {
    switch (targetType) {
      case ReportTargetType.USER:
        return this.assertUserTarget(user, targetId);
      case ReportTargetType.JOB:
        return this.assertJobTarget(user, targetId);
      case ReportTargetType.OFFER:
        return this.assertOfferTarget(user, targetId);
      case ReportTargetType.CONVERSATION:
        return this.assertConversationTarget(user, targetId);
      case ReportTargetType.MESSAGE:
        return this.assertMessageTarget(user, targetId);
      case ReportTargetType.REVIEW:
        return this.assertReviewTarget(user, targetId);
      default:
        throw new BadRequestException('Unsupported report target type.');
    }
  }

  private async assertUserTarget(user: AuthenticatedUser, targetId: string) {
    if (targetId === user.id) {
      throw new BadRequestException('You cannot report yourself.');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException('Reported user not found.');
    }
  }

  private async assertJobTarget(user: AuthenticatedUser, targetId: string) {
    const job = await this.prisma.jobRequest.findUnique({
      where: { id: targetId },
      select: { id: true, employerId: true },
    });
    if (!job) {
      throw new NotFoundException('Reported job not found.');
    }
    if (job.employerId === user.id) {
      throw new BadRequestException('You cannot report your own job.');
    }
  }

  private async assertOfferTarget(user: AuthenticatedUser, targetId: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: targetId },
      select: { id: true, contractorId: true, jobRequest: { select: { employerId: true } } },
    });
    if (!offer) {
      throw new NotFoundException('Reported offer not found.');
    }
    if (offer.contractorId === user.id) {
      throw new BadRequestException('You cannot report your own offer.');
    }
    if (offer.jobRequest.employerId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can report only offers related to your jobs.');
    }
  }

  private async assertConversationTarget(user: AuthenticatedUser, targetId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: targetId },
      select: { id: true, employerId: true, contractorId: true },
    });
    if (!conversation) {
      throw new NotFoundException('Reported conversation not found.');
    }
    if (conversation.employerId !== user.id && conversation.contractorId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can report only conversations you participate in.');
    }
  }

  private async assertMessageTarget(user: AuthenticatedUser, targetId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        senderId: true,
        conversation: { select: { employerId: true, contractorId: true } },
      },
    });
    if (!message || !message.conversation) {
      throw new NotFoundException('Reported message not found.');
    }
    if (message.senderId === user.id) {
      throw new BadRequestException('You cannot report your own message.');
    }
    if (
      message.conversation.employerId !== user.id &&
      message.conversation.contractorId !== user.id &&
      user.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('You can report only messages in your conversations.');
    }
  }

  private async assertReviewTarget(user: AuthenticatedUser, targetId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: targetId },
      select: { id: true, employerId: true, contractorId: true },
    });
    if (review) {
      if (review.employerId === user.id) {
        throw new BadRequestException('You cannot report your own review.');
      }
      if (review.contractorId !== user.id && user.role !== UserRole.ADMIN) {
        throw new ForbiddenException('You can report only reviews related to you.');
      }
      return;
    }

    const employerReview = await this.prisma.employerReview.findUnique({
      where: { id: targetId },
      select: { id: true, employerId: true, contractorId: true },
    });
    if (!employerReview) {
      throw new NotFoundException('Reported review not found.');
    }
    if (employerReview.contractorId === user.id) {
      throw new BadRequestException('You cannot report your own review.');
    }
    if (employerReview.employerId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can report only reviews related to you.');
    }
  }

  private async assertRateLimit(reporterId: string) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const count = await this.prisma.report.count({
      where: {
        reporterId,
        createdAt: { gte: since },
      },
    });

    if (count >= 10) {
      throw new HttpException('You can submit up to 10 reports per day.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async assertNoDuplicatePendingReport(reporterId: string, targetType: ReportTargetType, targetId: string) {
    const existing = await this.prisma.report.findFirst({
      where: {
        reporterId,
        targetType,
        targetId,
        status: { in: [ReportStatus.PENDING, ReportStatus.UNDER_REVIEW] },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('You already have an active report for this item.');
    }
  }

  private filterWhere(query: ReportsQueryDto): Prisma.ReportWhereInput {
    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.reason ? { reason: query.reason } : {}),
      ...(query.reporterId ? { reporterId: query.reporterId } : {}),
      ...(query.fromDate || query.toDate
        ? {
            createdAt: {
              ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
              ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
            },
          }
        : {}),
    };
  }

  private async getReport(reportId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: reportInclude,
    });

    if (!report) {
      throw new NotFoundException('Report not found.');
    }

    return report;
  }

  private async toReport(
    report: ReportWithRelations,
    options: { includeReporter: boolean; includeAdminTargetDetails?: boolean },
  ) {
    return {
      id: report.id,
      reporterId: options.includeReporter ? report.reporterId : undefined,
      reporter: options.includeReporter ? report.reporter : undefined,
      targetType: report.targetType,
      targetId: report.targetId,
      targetSummary: await this.targetSummary(report, Boolean(options.includeAdminTargetDetails)),
      reason: report.reason,
      description: report.description,
      status: report.status,
      reviewedByAdminId: report.reviewedByAdminId,
      reviewedByAdmin: report.reviewedByAdmin,
      adminNote: report.adminNote,
      reviewedAt: report.reviewedAt,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    };
  }

  private async targetSummary(report: Pick<Report, 'targetType' | 'targetId'>, includeAdminDetails: boolean): Promise<TargetSummary> {
    switch (report.targetType) {
      case ReportTargetType.USER: {
        const user = await this.prisma.user.findUnique({
          where: { id: report.targetId },
          select: { email: true, role: true, status: true, profile: true },
        });
        return user
          ? {
              title: user.profile?.displayName ?? user.email,
              subtitle: `${user.role} / ${user.status}`,
              metadata: includeAdminDetails ? { email: user.email, location: user.profile?.location } : undefined,
            }
          : { title: 'Deleted user' };
      }
      case ReportTargetType.JOB: {
        const job = await this.prisma.jobRequest.findUnique({
          where: { id: report.targetId },
          select: { title: true, status: true, location: true, category: true, subcategory: true },
        });
        return job
          ? { title: job.title, subtitle: `${job.status} / ${job.location}`, metadata: { category: job.category, subcategory: job.subcategory } }
          : { title: 'Deleted job' };
      }
      case ReportTargetType.OFFER: {
        const offer = await this.prisma.offer.findUnique({
          where: { id: report.targetId },
          select: { status: true, estimatedPrice: true, jobRequest: { select: { title: true } } },
        });
        return offer
          ? { title: `Offer for ${offer.jobRequest.title}`, subtitle: `${offer.status} / EUR ${offer.estimatedPrice.toString()}` }
          : { title: 'Deleted offer' };
      }
      case ReportTargetType.CONVERSATION: {
        const conversation = await this.prisma.conversation.findUnique({
          where: { id: report.targetId },
          select: {
            employer: { select: { email: true, profile: true } },
            contractor: { select: { email: true, profile: true } },
            contactUnlock: { select: { jobRequest: { select: { title: true } } } },
          },
        });
        return conversation
          ? {
              title: `Conversation: ${conversation.contactUnlock.jobRequest.title}`,
              subtitle: includeAdminDetails
                ? `${conversation.employer.profile?.displayName ?? conversation.employer.email} / ${
                    conversation.contractor.profile?.displayName ?? conversation.contractor.email
                  }`
                : 'Conversation',
            }
          : { title: 'Deleted conversation' };
      }
      case ReportTargetType.MESSAGE: {
        const message = await this.prisma.message.findUnique({
          where: { id: report.targetId },
          select: {
            content: true,
            deletedAt: true,
            sender: { select: { email: true, profile: true } },
            conversation: { select: { contactUnlock: { select: { jobRequest: { select: { title: true } } } } } },
          },
        });
        return message
          ? {
              title: `Message: ${message.conversation?.contactUnlock.jobRequest.title ?? 'Conversation'}`,
              subtitle: message.deletedAt ? 'Hidden message' : this.truncate(message.content, includeAdminDetails ? 180 : 80),
              metadata: includeAdminDetails ? { sender: message.sender.profile?.displayName ?? message.sender.email } : undefined,
            }
          : { title: 'Deleted message' };
      }
      case ReportTargetType.REVIEW: {
        const review = await this.prisma.review.findUnique({
          where: { id: report.targetId },
          select: { rating: true, comment: true, status: true, jobRequest: { select: { title: true } } },
        });
        if (review) {
          return {
            title: `Review: ${review.jobRequest.title}`,
            subtitle: `${review.rating} stars / ${review.status}`,
            metadata: includeAdminDetails ? { comment: review.comment } : undefined,
          };
        }
        const employerReview = await this.prisma.employerReview.findUnique({
          where: { id: report.targetId },
          select: { rating: true, comment: true, status: true, jobRequest: { select: { title: true } } },
        });
        return employerReview
          ? {
              title: `Employer review: ${employerReview.jobRequest.title}`,
              subtitle: `${employerReview.rating} stars / ${employerReview.status}`,
              metadata: includeAdminDetails ? { comment: employerReview.comment } : undefined,
            }
          : { title: 'Deleted review' };
      }
      default:
        return { title: 'Unknown target' };
    }
  }

  private statusAuditAction(status: ReportStatus) {
    switch (status) {
      case ReportStatus.UNDER_REVIEW:
        return 'REPORT_MARKED_UNDER_REVIEW';
      case ReportStatus.RESOLVED:
        return 'REPORT_RESOLVED';
      case ReportStatus.DISMISSED:
        return 'REPORT_DISMISSED';
      default:
        return 'REPORT_STATUS_UPDATED';
    }
  }

  private reportStatusTitle(status: ReportStatus) {
    switch (status) {
      case ReportStatus.UNDER_REVIEW:
        return 'Your report is under review';
      case ReportStatus.RESOLVED:
        return 'Your report was resolved';
      case ReportStatus.DISMISSED:
        return 'Your report was dismissed';
      default:
        return 'Your report was updated';
    }
  }

  private reportStatusBody(status: ReportStatus) {
    switch (status) {
      case ReportStatus.UNDER_REVIEW:
        return 'Our admin team is reviewing your report.';
      case ReportStatus.RESOLVED:
        return 'Our admin team reviewed and resolved your report.';
      case ReportStatus.DISMISSED:
        return 'Our admin team reviewed your report and dismissed it.';
      default:
        return 'Your report status changed.';
    }
  }

  private reportAuditMetadata(report: Report | ReportWithRelations, adminNote?: string) {
    return {
      reportId: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      adminNote,
    };
  }

  private async recalculateContractorRating(tx: Prisma.TransactionClient, contractorId: string) {
    const aggregate = await tx.review.aggregate({
      where: { contractorId, status: ReviewStatus.ACTIVE, removedAt: null },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await tx.contractorRatingSummary.upsert({
      where: { contractorId },
      create: {
        contractorId,
        averageRating: new Prisma.Decimal((aggregate._avg.rating ?? 0).toFixed(2)),
        totalReviews: aggregate._count.rating,
      },
      update: {
        averageRating: new Prisma.Decimal((aggregate._avg.rating ?? 0).toFixed(2)),
        totalReviews: aggregate._count.rating,
      },
    });
  }

  private async recalculateEmployerRating(tx: Prisma.TransactionClient, employerId: string) {
    const aggregate = await tx.employerReview.aggregate({
      where: { employerId, status: ReviewStatus.ACTIVE, removedAt: null },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await tx.employerRatingSummary.upsert({
      where: { employerId },
      create: {
        employerId,
        averageRating: new Prisma.Decimal((aggregate._avg.rating ?? 0).toFixed(2)),
        totalReviews: aggregate._count.rating,
      },
      update: {
        averageRating: new Prisma.Decimal((aggregate._avg.rating ?? 0).toFixed(2)),
        totalReviews: aggregate._count.rating,
      },
    });
  }

  private cleanOptional(value?: string | null) {
    const cleaned = value?.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
    return cleaned || undefined;
  }

  private truncate(value: string, max: number) {
    return value.length > max ? `${value.slice(0, max - 3)}...` : value;
  }
}
