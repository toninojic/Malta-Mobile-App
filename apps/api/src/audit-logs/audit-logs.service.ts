import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditLog, Prisma } from '@prisma/client';
import { PaginatedResponse, paginationMeta } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';

export type AuditLogCreateInput = {
  adminId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: AuditLogCreateInput, tx: Prisma.TransactionClient | PrismaService = this.prisma) {
    const auditLog = await tx.auditLog.create({
      data: input,
    });

    return this.toAuditLog(auditLog);
  }

  async findAll(query: AuditLogsQueryDto): Promise<PaginatedResponse<ReturnType<AuditLogsService['toAuditLog']>>> {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.adminId ? { adminId: query.adminId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.fromDate || query.toDate
        ? {
            createdAt: {
              ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
              ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
            },
          }
        : {}),
    };

    const [auditLogs, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: {
          admin: {
            select: {
              id: true,
              email: true,
              role: true,
              status: true,
              profile: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: auditLogs.map((auditLog) => this.toAuditLog(auditLog)),
      pagination: paginationMeta(query.page, query.limit, total),
    };
  }

  async findOne(id: string) {
    const auditLog = await this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            profile: true,
          },
        },
      },
    });

    if (!auditLog) {
      throw new NotFoundException('Audit log not found.');
    }

    return this.toAuditLog(auditLog);
  }

  private toAuditLog(auditLog: AuditLog & { admin?: unknown }) {
    return {
      id: auditLog.id,
      adminId: auditLog.adminId,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
      admin: 'admin' in auditLog ? auditLog.admin : undefined,
    };
  }
}
