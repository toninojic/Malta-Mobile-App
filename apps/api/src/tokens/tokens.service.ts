import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationType,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  RefundStatus,
  TokenTransactionType,
  UserRole,
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PaginatedResponse, PaginationQueryDto, paginationMeta } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminRefundDecisionDto } from './dto/admin-refund-decision.dto';
import { AdminGrantTokensDto, AdminRevokeTokensDto } from './dto/admin-token-adjustment.dto';
import { CreateRefundRequestDto } from './dto/create-refund-request.dto';
import { CreateTokenPackageDto } from './dto/create-token-package.dto';
import { MockPurchaseDto } from './dto/mock-purchase.dto';
import { RefundsQueryDto } from './dto/refunds-query.dto';
import { UpdateTokenPackageDto } from './dto/update-token-package.dto';

const refundInclude = {
  requestedBy: {
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      profile: true,
    },
  },
  tokenTransaction: {
    include: {
      package: true,
    },
  },
  refundTransaction: true,
  reviewedBy: {
    select: {
      id: true,
      email: true,
      profile: true,
    },
  },
};

type RefundWithRelations = Prisma.RefundRequestGetPayload<{ include: typeof refundInclude }>;
type TokenPackageEntity = Prisma.TokenPackageGetPayload<Record<string, never>>;
type TokenTransactionWithPackage = Prisma.TokenTransactionGetPayload<{ include: { package: true } }>;

function parseBooleanEnv(value: string | undefined) {
  return ['true', '1', 'yes', 'on'].includes(String(value ?? '').trim().replace(/^['"]|['"]$/g, '').toLowerCase());
}

@Injectable()
export class TokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly notificationsService: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async findActivePackages() {
    const packages = await this.prisma.tokenPackage.findMany({
      where: { isActive: true },
      orderBy: { tokenCount: 'asc' },
    });

    return packages.map((tokenPackage) => this.toPackage(tokenPackage));
  }

  async createPackage(user: AuthenticatedUser, dto: CreateTokenPackageDto) {
    this.assertAdmin(user);

    try {
      const tokenPackage = await this.prisma.$transaction(async (tx) => {
        const created = await tx.tokenPackage.create({
          data: {
            title: dto.title,
            tokenCount: dto.tokenCount,
            price: new Prisma.Decimal(dto.price),
            currency: dto.currency ?? 'EUR',
            isActive: dto.isActive ?? true,
          },
        });

        await this.auditLogsService.create(
          {
            adminId: user.id,
            action: 'TOKEN_PACKAGE_CREATED',
            entityType: 'TokenPackage',
            entityId: created.id,
            metadata: {
              title: created.title,
              tokenCount: created.tokenCount,
              price: created.price.toString(),
              currency: created.currency,
              isActive: created.isActive,
            },
          },
          tx,
        );

        return created;
      });

      return this.toPackage(tokenPackage);
    } catch (error) {
      if (this.isPrismaError(error, 'P2002')) {
        throw new ConflictException('A token package with this title already exists.');
      }

      throw error;
    }
  }

  async updatePackage(user: AuthenticatedUser, id: string, dto: UpdateTokenPackageDto) {
    this.assertAdmin(user);

    try {
      const tokenPackage = await this.prisma.$transaction(async (tx) => {
        const previous = await tx.tokenPackage.findUnique({
          where: { id },
        });

        if (!previous) {
          throw new NotFoundException('Token package not found.');
        }

        const updated = await tx.tokenPackage.update({
          where: { id },
          data: {
            title: dto.title,
            tokenCount: dto.tokenCount,
            price: dto.price === undefined ? undefined : new Prisma.Decimal(dto.price),
            currency: dto.currency,
            isActive: dto.isActive,
          },
        });

        await this.auditLogsService.create(
          {
            adminId: user.id,
            action: 'TOKEN_PACKAGE_UPDATED',
            entityType: 'TokenPackage',
            entityId: updated.id,
            metadata: {
              previous: {
                title: previous.title,
                tokenCount: previous.tokenCount,
                price: previous.price.toString(),
                currency: previous.currency,
                isActive: previous.isActive,
              },
              next: {
                title: updated.title,
                tokenCount: updated.tokenCount,
                price: updated.price.toString(),
                currency: updated.currency,
                isActive: updated.isActive,
              },
            },
          },
          tx,
        );

        return updated;
      });

      return this.toPackage(tokenPackage);
    } catch (error) {
      if (this.isPrismaError(error, 'P2025')) {
        throw new NotFoundException('Token package not found.');
      }

      if (this.isPrismaError(error, 'P2002')) {
        throw new ConflictException('A token package with this title already exists.');
      }

      throw error;
    }
  }

  async getBalance(user: AuthenticatedUser) {
    const wallet = await this.ensureWallet(user.id);
    return this.toBalance(wallet);
  }

  async claimWelcomeBonus(user: AuthenticatedUser) {
    this.assertContractor(user);

    const target = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        role: true,
        contractorOnboardingRequiredAt: true,
        contractorOnboardingCompletedAt: true,
        contractorOnboardingSkippedAt: true,
        welcomeBonusGrantedAt: true,
      },
    });

    if (!target || target.role !== UserRole.CONTRACTOR) {
      throw new ForbiddenException('Only contractors can receive welcome tokens.');
    }

    if (!target.contractorOnboardingRequiredAt) {
      return {
        granted: false,
        reason: 'WELCOME_BONUS_NOT_AVAILABLE',
        balance: this.toBalance(await this.ensureWallet(user.id)),
        transaction: null,
      };
    }

    if (target.contractorOnboardingSkippedAt && !target.contractorOnboardingCompletedAt) {
      return {
        granted: false,
        reason: 'WELCOME_BONUS_SKIPPED',
        balance: this.toBalance(await this.ensureWallet(user.id)),
        transaction: null,
      };
    }

    if (target.welcomeBonusGrantedAt) {
      return {
        granted: false,
        reason: 'WELCOME_BONUS_ALREADY_GRANTED',
        balance: this.toBalance(await this.ensureWallet(user.id)),
        transaction: null,
      };
    }

    if (!this.welcomeBonusEnabled()) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { contractorOnboardingCompletedAt: target.contractorOnboardingCompletedAt ?? new Date() },
      });
      return {
        granted: false,
        reason: 'WELCOME_BONUS_DISABLED',
        balance: this.toBalance(await this.ensureWallet(user.id)),
        transaction: null,
      };
    }

    const tokenAmount = this.welcomeBonusTokens();
    const result = await this.prisma.$transaction(async (tx) => {
      await this.ensureWallet(user.id, tx);

      const marked = await tx.user.updateMany({
        where: {
          id: user.id,
          role: UserRole.CONTRACTOR,
          contractorOnboardingRequiredAt: { not: null },
          contractorOnboardingSkippedAt: null,
          welcomeBonusGrantedAt: null,
        },
        data: {
          contractorOnboardingCompletedAt: target.contractorOnboardingCompletedAt ?? new Date(),
          welcomeBonusGrantedAt: new Date(),
        },
      });

      if (marked.count !== 1) {
        const wallet = await tx.userTokenBalance.findUniqueOrThrow({ where: { userId: user.id } });
        return { granted: false, wallet, transaction: null };
      }

      const wallet = await tx.userTokenBalance.update({
        where: { userId: user.id },
        data: {
          balance: { increment: tokenAmount },
          version: { increment: 1 },
        },
      });

      const transaction = await tx.tokenTransaction.create({
        data: {
          userId: user.id,
          type: TokenTransactionType.WELCOME_BONUS,
          amount: tokenAmount,
          balanceAfter: wallet.balance,
          description: 'Welcome bonus',
          externalRef: `welcome-bonus:${user.id}`,
        },
        include: { package: true },
      });

      await this.notificationsService.create(
        {
          userId: user.id,
          type: NotificationType.SYSTEM_ALERT,
          title: 'Welcome tokens added',
          body: `You received ${tokenAmount} welcome tokens.`,
          data: {
            type: 'WELCOME_BONUS',
            amount: tokenAmount,
            transactionId: transaction.id,
            target: 'wallet',
          },
        },
        tx,
      );

      return { granted: true, wallet, transaction };
    });

    return {
      granted: result.granted,
      reason: result.granted ? null : 'WELCOME_BONUS_ALREADY_GRANTED',
      balance: this.toBalance(result.wallet),
      transaction: result.transaction ? this.toTransaction(result.transaction) : null,
    };
  }

  async skipWelcomeBonusOnboarding(user: AuthenticatedUser) {
    this.assertContractor(user);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        contractorOnboardingSkippedAt: new Date(),
      },
    });

    return { success: true };
  }

  async findTransactions(
    user: AuthenticatedUser,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<ReturnType<TokensService['toTransaction']>>> {
    const where: Prisma.TokenTransactionWhereInput = { userId: user.id };

    const [transactions, total] = await this.prisma.$transaction([
      this.prisma.tokenTransaction.findMany({
        where,
        include: { package: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.tokenTransaction.count({ where }),
    ]);

    return {
      data: transactions.map((transaction) => this.toTransaction(transaction)),
      pagination: paginationMeta(query.page, query.limit, total),
    };
  }

  async mockPurchase(user: AuthenticatedUser, dto: MockPurchaseDto) {
    if (!parseBooleanEnv(this.config.get<string>('ALLOW_MOCK_PURCHASES'))) {
      throw new GoneException('Mock purchases are disabled.');
    }

    const tokenPackage = await this.prisma.tokenPackage.findUnique({
      where: { id: dto.tokenPackageId },
    });

    if (!tokenPackage) {
      throw new NotFoundException('Token package not found.');
    }

    if (!tokenPackage.isActive) {
      throw new BadRequestException('Token package is inactive.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await this.ensureWallet(user.id, tx);

      const wallet = await tx.userTokenBalance.update({
        where: { userId: user.id },
        data: {
          balance: { increment: tokenPackage.tokenCount },
          version: { increment: 1 },
        },
      });

      const transaction = await tx.tokenTransaction.create({
        data: {
          userId: user.id,
          packageId: tokenPackage.id,
          type: TokenTransactionType.PURCHASE,
          amount: tokenPackage.tokenCount,
          balanceAfter: wallet.balance,
          description: `Mock purchase: ${tokenPackage.title}`,
        },
        include: { package: true },
      });

      await tx.payment.create({
        data: {
          userId: user.id,
          tokenPackageId: tokenPackage.id,
          provider: PaymentProvider.MOCK,
          amount: tokenPackage.price,
          currency: tokenPackage.currency,
          status: PaymentStatus.COMPLETED,
        },
      });

      return { wallet, transaction };
    });

    return {
      balance: this.toBalance(result.wallet),
      transaction: this.toTransaction(result.transaction),
    };
  }

  async adminGrantTokens(admin: AuthenticatedUser, userId: string, dto: AdminGrantTokensDto) {
    this.assertAdmin(admin);
    const contractor = await this.getContractorTarget(userId);

    const result = await this.prisma.$transaction(async (tx) => {
      await this.ensureWallet(contractor.id, tx);

      const wallet = await tx.userTokenBalance.update({
        where: { userId: contractor.id },
        data: {
          balance: { increment: dto.amount },
          version: { increment: 1 },
        },
      });

      const transaction = await tx.tokenTransaction.create({
        data: {
          userId: contractor.id,
          type: TokenTransactionType.ADMIN_GRANT,
          amount: dto.amount,
          balanceAfter: wallet.balance,
          description: `Admin grant: ${dto.reason}`,
        },
        include: { package: true },
      });

      await this.auditLogsService.create(
        {
          adminId: admin.id,
          action: 'TOKENS_ADMIN_GRANTED',
          entityType: 'User',
          entityId: contractor.id,
          metadata: {
            amount: dto.amount,
            reason: dto.reason,
            transactionId: transaction.id,
          },
        },
        tx,
      );

      await this.notificationsService.create(
        {
          userId: contractor.id,
          type: NotificationType.SYSTEM_ALERT,
          title: 'Promotional tokens added',
          body: `You received ${dto.amount} promotional tokens.`,
          data: {
            type: 'ADMIN_GRANT',
            amount: dto.amount,
            transactionId: transaction.id,
            target: 'wallet',
          },
        },
        tx,
      );

      return { wallet, transaction };
    });

    return {
      balance: this.toBalance(result.wallet),
      transaction: this.toTransaction(result.transaction),
    };
  }

  async adminRevokeTokens(admin: AuthenticatedUser, userId: string, dto: AdminRevokeTokensDto) {
    this.assertAdmin(admin);
    const contractor = await this.getContractorTarget(userId);

    const result = await this.prisma.$transaction(async (tx) => {
      await this.ensureWallet(contractor.id, tx);

      const updated = await tx.userTokenBalance.updateMany({
        where: {
          userId: contractor.id,
          balance: { gte: dto.amount },
        },
        data: {
          balance: { decrement: dto.amount },
          version: { increment: 1 },
        },
      });

      if (updated.count !== 1) {
        throw new BadRequestException('Cannot revoke more tokens than current balance.');
      }

      const wallet = await tx.userTokenBalance.findUniqueOrThrow({
        where: { userId: contractor.id },
      });

      const transaction = await tx.tokenTransaction.create({
        data: {
          userId: contractor.id,
          type: TokenTransactionType.ADMIN_REVOKE,
          amount: -dto.amount,
          balanceAfter: wallet.balance,
          description: `Admin revoke: ${dto.reason}`,
        },
        include: { package: true },
      });

      await this.auditLogsService.create(
        {
          adminId: admin.id,
          action: 'TOKENS_ADMIN_REVOKED',
          entityType: 'User',
          entityId: contractor.id,
          metadata: {
            amount: dto.amount,
            reason: dto.reason,
            transactionId: transaction.id,
          },
        },
        tx,
      );

      await this.notificationsService.create(
        {
          userId: contractor.id,
          type: NotificationType.SYSTEM_ALERT,
          title: 'Tokens removed',
          body: `${dto.amount} tokens were removed from your wallet by admin.`,
          data: {
            type: 'ADMIN_REVOKE',
            amount: dto.amount,
            transactionId: transaction.id,
            target: 'wallet',
          },
        },
        tx,
      );

      return { wallet, transaction };
    });

    return {
      balance: this.toBalance(result.wallet),
      transaction: this.toTransaction(result.transaction),
    };
  }

  async createRefundRequest(user: AuthenticatedUser, dto: CreateRefundRequestDto) {
    const transaction = await this.prisma.tokenTransaction.findUnique({
      where: { id: dto.tokenTransactionId },
      include: { refundRequest: true },
    });

    if (!transaction) {
      throw new NotFoundException('Token transaction not found.');
    }

    if (transaction.userId !== user.id) {
      throw new ForbiddenException('You can request refunds only for your own transactions.');
    }

    if (transaction.type !== TokenTransactionType.PURCHASE || transaction.amount <= 0) {
      throw new BadRequestException('Refunds can be requested only for purchase transactions.');
    }

    if (transaction.refundRequest) {
      throw new ConflictException('A refund request already exists for this transaction.');
    }

    try {
      const refund = await this.prisma.$transaction(async (tx) => {
        const created = await tx.refundRequest.create({
          data: {
            userId: user.id,
            tokenTransactionId: transaction.id,
            amount: transaction.amount,
            reason: dto.reason,
          },
          include: refundInclude,
        });

        await this.notificationsService.createForAdmins(
          {
            type: NotificationType.NEW_REFUND_REQUEST,
            title: 'New refund request',
            body: 'A contractor requested a token refund.',
            data: {
              refundRequestId: created.id,
              userId: user.id,
              target: 'adminRefunds',
            },
          },
          tx,
        );

        return created;
      });

      return this.toRefund(refund);
    } catch (error) {
      if (this.isPrismaError(error, 'P2002')) {
        throw new ConflictException('A refund request already exists for this transaction.');
      }

      throw error;
    }
  }

  async findMyRefunds(
    user: AuthenticatedUser,
    query: RefundsQueryDto,
  ): Promise<PaginatedResponse<ReturnType<TokensService['toRefund']>>> {
    const where: Prisma.RefundRequestWhereInput = {
      userId: user.id,
      ...(query.status ? { status: query.status } : {}),
    };

    const [refunds, total] = await this.prisma.$transaction([
      this.prisma.refundRequest.findMany({
        where,
        include: refundInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.refundRequest.count({ where }),
    ]);

    return {
      data: refunds.map((refund) => this.toRefund(refund)),
      pagination: paginationMeta(query.page, query.limit, total),
    };
  }

  async findAdminRefunds(query: RefundsQueryDto): Promise<PaginatedResponse<ReturnType<TokensService['toRefund']>>> {
    const where: Prisma.RefundRequestWhereInput = {
      ...(query.status ? { status: query.status } : {}),
    };

    const [refunds, total] = await this.prisma.$transaction([
      this.prisma.refundRequest.findMany({
        where,
        include: refundInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.refundRequest.count({ where }),
    ]);

    return {
      data: refunds.map((refund) => this.toRefund(refund)),
      pagination: paginationMeta(query.page, query.limit, total),
    };
  }

  async approveRefund(user: AuthenticatedUser, refundRequestId: string, dto: AdminRefundDecisionDto) {
    this.assertAdmin(user);

    const refund = await this.prisma.refundRequest.findUnique({
      where: { id: refundRequestId },
      include: refundInclude,
    });

    if (!refund) {
      throw new NotFoundException('Refund request not found.');
    }

    if (refund.status !== RefundStatus.PENDING) {
      throw new BadRequestException('Refund request has already been processed.');
    }

    const approved = await this.prisma.$transaction(async (tx) => {
      await this.ensureWallet(refund.userId, tx);

      const balanceUpdate = await tx.userTokenBalance.updateMany({
        where: {
          userId: refund.userId,
          balance: { gte: refund.amount },
        },
        data: {
          balance: { decrement: refund.amount },
          version: { increment: 1 },
        },
      });

      if (balanceUpdate.count !== 1) {
        throw new BadRequestException('User has insufficient token balance for this refund.');
      }

      const wallet = await tx.userTokenBalance.findUniqueOrThrow({
        where: { userId: refund.userId },
      });

      const refundTransaction = await tx.tokenTransaction.create({
        data: {
          userId: refund.userId,
          type: TokenTransactionType.REFUND,
          amount: -refund.amount,
          balanceAfter: wallet.balance,
          description: `Refund approved for purchase ${refund.tokenTransactionId}`,
          relatedRefundRequestId: refund.id,
        },
      });

      const updated = await tx.refundRequest.update({
        where: { id: refund.id },
        data: {
          status: RefundStatus.APPROVED,
          adminNote: dto.adminNote,
          reviewedByAdminId: user.id,
          reviewedAt: new Date(),
        },
        include: refundInclude,
      });

      await this.auditLogsService.create(
        {
          adminId: user.id,
          action: 'REFUND_APPROVED',
          entityType: 'RefundRequest',
          entityId: refund.id,
          metadata: {
            userId: refund.userId,
            amount: refund.amount,
            adminNote: dto.adminNote,
            refundTransactionId: refundTransaction.id,
          },
        },
        tx,
      );

      await this.notificationsService.create(
        {
          userId: refund.userId,
          type: NotificationType.REFUND_APPROVED,
          title: 'Refund approved',
          body: 'Your refund request was approved.',
          data: {
            refundRequestId: refund.id,
            amount: refund.amount,
          },
        },
        tx,
      );

      return updated;
    });

    return this.toRefund(approved);
  }

  async rejectRefund(user: AuthenticatedUser, refundRequestId: string, dto: AdminRefundDecisionDto) {
    this.assertAdmin(user);

    const refund = await this.prisma.refundRequest.findUnique({
      where: { id: refundRequestId },
    });

    if (!refund) {
      throw new NotFoundException('Refund request not found.');
    }

    if (refund.status !== RefundStatus.PENDING) {
      throw new BadRequestException('Refund request has already been processed.');
    }

    const rejected = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.refundRequest.update({
        where: { id: refund.id },
        data: {
          status: RefundStatus.REJECTED,
          adminNote: dto.adminNote,
          reviewedByAdminId: user.id,
          reviewedAt: new Date(),
        },
        include: refundInclude,
      });

      await this.auditLogsService.create(
        {
          adminId: user.id,
          action: 'REFUND_REJECTED',
          entityType: 'RefundRequest',
          entityId: refund.id,
          metadata: {
            userId: refund.userId,
            amount: refund.amount,
            adminNote: dto.adminNote,
          },
        },
        tx,
      );

      await this.notificationsService.create(
        {
          userId: refund.userId,
          type: NotificationType.REFUND_DENIED,
          title: 'Refund rejected',
          body: 'Your refund request was rejected.',
          data: {
            refundRequestId: refund.id,
            amount: refund.amount,
          },
        },
        tx,
      );

      return updated;
    });

    return this.toRefund(rejected);
  }

  private async ensureWallet(userId: string, tx: Prisma.TransactionClient | PrismaService = this.prisma) {
    return tx.userTokenBalance.upsert({
      where: { userId },
      create: {
        userId,
        balance: 0,
      },
      update: {},
    });
  }

  private assertAdmin(user: AuthenticatedUser) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can manage tokens.');
    }
  }

  private assertContractor(user: AuthenticatedUser) {
    if (user.role !== UserRole.CONTRACTOR) {
      throw new ForbiddenException('Only contractors can receive tokens.');
    }
  }

  private async getContractorTarget(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.role !== UserRole.CONTRACTOR) {
      throw new BadRequestException('Promo tokens can be granted only to contractors.');
    }

    return user;
  }

  private welcomeBonusEnabled() {
    const value = this.config.get<string>('WELCOME_BONUS_ENABLED');
    if (value === undefined || value === '') {
      return true;
    }

    return parseBooleanEnv(value);
  }

  private welcomeBonusTokens() {
    const configured = Number(this.config.get<string>('WELCOME_BONUS_TOKENS') ?? 10);
    return Number.isInteger(configured) && configured > 0 ? configured : 10;
  }

  private isPrismaError(error: unknown, code: string) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
  }

  private toPackage(tokenPackage: TokenPackageEntity) {
    return {
      id: tokenPackage.id,
      title: tokenPackage.title,
      tokenCount: tokenPackage.tokenCount,
      price: tokenPackage.price.toString(),
      currency: tokenPackage.currency,
      isActive: tokenPackage.isActive,
      createdAt: tokenPackage.createdAt,
      updatedAt: tokenPackage.updatedAt,
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

  private toTransaction(transaction: TokenTransactionWithPackage) {
    return {
      id: transaction.id,
      userId: transaction.userId,
      packageId: transaction.packageId,
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      balanceAfter: transaction.balanceAfter,
      relatedRefundRequestId: transaction.relatedRefundRequestId,
      package: transaction.package ? this.toPackage(transaction.package) : null,
      createdAt: transaction.createdAt,
    };
  }

  private toRefund(refund: RefundWithRelations) {
    return {
      id: refund.id,
      userId: refund.userId,
      tokenTransactionId: refund.tokenTransactionId,
      amount: refund.amount,
      reason: refund.reason,
      status: refund.status,
      adminNote: refund.adminNote,
      reviewedByAdminId: refund.reviewedByAdminId,
      reviewedAt: refund.reviewedAt,
      requestedBy: refund.requestedBy,
      tokenTransaction: this.toTransaction(refund.tokenTransaction),
      refundTransaction: refund.refundTransaction
        ? {
            id: refund.refundTransaction.id,
            type: refund.refundTransaction.type,
            amount: refund.refundTransaction.amount,
            description: refund.refundTransaction.description,
            balanceAfter: refund.refundTransaction.balanceAfter,
            createdAt: refund.refundTransaction.createdAt,
          }
        : null,
      reviewedBy: refund.reviewedBy,
      createdAt: refund.createdAt,
      updatedAt: refund.updatedAt,
    };
  }
}
