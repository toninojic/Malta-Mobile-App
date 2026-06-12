import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider, PaymentStatus, Prisma, StorePlatform, TokenTransactionType, UserRole } from '@prisma/client';
import { PaginatedResponse, PaginationQueryDto, paginationMeta } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

const paymentInclude = {
  tokenPackage: true,
};

const REVENUECAT_PURCHASE_EVENT_TYPES = new Set(['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE']);

type PaymentWithPackage = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;

type RevenueCatWebhookPayload = {
  event?: Record<string, unknown>;
};

type RevenueCatEvent = {
  eventId: string;
  type: string;
  appUserId: string;
  productId: string;
  transactionId?: string;
  amount?: Prisma.Decimal;
  currency?: string;
};

function parseBooleanEnv(value: string | undefined) {
  return ['true', '1', 'yes', 'on'].includes(String(value ?? '').trim().replace(/^['"]|['"]$/g, '').toLowerCase());
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  getConfig() {
    const mockPurchasesEnabled = this.isMockPurchasesEnabled();
    const revenueCatConfigured = this.isRevenueCatConfigured();
    const purchasesConfigured = mockPurchasesEnabled || revenueCatConfigured;

    return {
      mode: mockPurchasesEnabled ? 'MOCK' : revenueCatConfigured ? 'REVENUECAT' : 'UNCONFIGURED',
      allowMockPurchases: mockPurchasesEnabled,
      mockPurchasesEnabled,
      revenueCatConfigured,
      purchasesConfigured,
      provider: 'REVENUECAT',
    };
  }

  async createCheckoutSession(user: AuthenticatedUser, _dto: CreateCheckoutSessionDto) {
    if (user.role !== UserRole.CONTRACTOR) {
      throw new ForbiddenException('Only contractors can purchase token packages.');
    }

    throw new GoneException('Stripe Checkout is no longer active. Use RevenueCat in-app purchases or development mock purchases.');
  }

  async findMine(
    user: AuthenticatedUser,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<ReturnType<PaymentsService['toPayment']>>> {
    const where: Prisma.PaymentWhereInput = { userId: user.id };

    const [payments, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: paymentInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: payments.map((payment) => this.toPayment(payment)),
      pagination: paginationMeta(query.page, query.limit, total),
    };
  }

  handleDeprecatedStripeWebhook() {
    throw new GoneException('Stripe webhook is deprecated and is not an active payment path.');
  }

  async handleRevenueCatWebhook(input: {
    authorization?: string;
    revenueCatSignature?: string;
    webhookSecret?: string;
    rawBody: Buffer;
  }) {
    this.verifyRevenueCatWebhookSecret(input);

    const payload = this.parseRevenueCatPayload(input.rawBody);
    const event = this.extractRevenueCatEvent(payload);

    if (!event) {
      this.logger.warn('Ignored malformed RevenueCat webhook payload.');
      return { received: true, ignored: true, reason: 'MALFORMED_EVENT' };
    }

    if (!REVENUECAT_PURCHASE_EVENT_TYPES.has(event.type)) {
      return { received: true, ignored: true, reason: 'UNSUPPORTED_EVENT_TYPE', eventType: event.type };
    }

    const result = await this.processRevenueCatPurchase(event);
    return { received: true, ...result };
  }

  private async processRevenueCatPurchase(event: RevenueCatEvent) {
    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        OR: [
          { revenueCatEventId: event.eventId },
          ...(event.transactionId ? [{ revenueCatTransactionId: event.transactionId }] : []),
        ],
      },
    });

    if (existingPayment?.status === PaymentStatus.COMPLETED || existingPayment?.status === PaymentStatus.PAID) {
      return { duplicate: true, paymentId: existingPayment.id };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: event.appUserId },
      select: { id: true, role: true, status: true },
    });

    if (!user) {
      this.logger.warn(`Ignored RevenueCat purchase for unknown appUserID ${event.appUserId}.`);
      return { ignored: true, reason: 'UNKNOWN_USER' };
    }

    if (user.role !== UserRole.CONTRACTOR) {
      this.logger.warn(`Ignored RevenueCat purchase for non-contractor user ${event.appUserId}.`);
      return { ignored: true, reason: 'INVALID_USER_ROLE' };
    }

    const storeProduct = await this.prisma.storeProduct.findFirst({
      where: {
        platformProductId: event.productId,
        platform: StorePlatform.REVENUECAT,
        isActive: true,
        tokenPackage: { isActive: true },
      },
      include: { tokenPackage: true },
    });

    if (!storeProduct) {
      this.logger.warn(`Ignored RevenueCat purchase for unknown product ${event.productId}.`);
      return { ignored: true, reason: 'UNKNOWN_PRODUCT' };
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const existingInsideTransaction = await tx.payment.findFirst({
        where: {
          OR: [
            { revenueCatEventId: event.eventId },
            ...(event.transactionId ? [{ revenueCatTransactionId: event.transactionId }] : []),
          ],
        },
      });

      if (
        existingInsideTransaction?.status === PaymentStatus.COMPLETED ||
        existingInsideTransaction?.status === PaymentStatus.PAID
      ) {
        return existingInsideTransaction;
      }

      const createdPayment = await tx.payment.create({
        data: {
          userId: user.id,
          tokenPackageId: storeProduct.tokenPackageId,
          provider: PaymentProvider.REVENUECAT,
          platform: StorePlatform.REVENUECAT,
          platformProductId: event.productId,
          revenueCatEventId: event.eventId,
          revenueCatTransactionId: event.transactionId,
          amount: event.amount ?? storeProduct.tokenPackage.price,
          currency: event.currency ?? storeProduct.tokenPackage.currency,
          status: PaymentStatus.COMPLETED,
        },
        include: paymentInclude,
      });

      await this.ensureWallet(user.id, tx);
      const wallet = await tx.userTokenBalance.update({
        where: { userId: user.id },
        data: {
          balance: { increment: storeProduct.tokenPackage.tokenCount },
          version: { increment: 1 },
        },
      });

      await tx.tokenTransaction.create({
        data: {
          userId: user.id,
          packageId: storeProduct.tokenPackageId,
          type: TokenTransactionType.PURCHASE,
          amount: storeProduct.tokenPackage.tokenCount,
          balanceAfter: wallet.balance,
          description: `RevenueCat purchase: ${storeProduct.tokenPackage.title}`,
          externalRef: event.eventId,
        },
      });

      return createdPayment;
    });

    return {
      granted: payment.status === PaymentStatus.COMPLETED,
      paymentId: payment.id,
      tokenPackageId: storeProduct.tokenPackageId,
      tokensGranted: storeProduct.tokenPackage.tokenCount,
    };
  }

  private verifyRevenueCatWebhookSecret(input: {
    authorization?: string;
    revenueCatSignature?: string;
    webhookSecret?: string;
  }) {
    const configuredSecret = this.config.get<string>('REVENUECAT_WEBHOOK_SECRET')?.trim();

    if (!configuredSecret) {
      return;
    }

    const acceptedHeaderValues = [
      input.authorization?.replace(/^Bearer\s+/i, '').trim(),
      input.authorization?.trim(),
      input.revenueCatSignature?.trim(),
      input.webhookSecret?.trim(),
    ].filter(Boolean);

    if (!acceptedHeaderValues.includes(configuredSecret)) {
      throw new UnauthorizedException('Invalid RevenueCat webhook secret.');
    }
  }

  private parseRevenueCatPayload(rawBody: Buffer): RevenueCatWebhookPayload {
    try {
      return JSON.parse(rawBody.toString('utf8')) as RevenueCatWebhookPayload;
    } catch {
      throw new BadRequestException('Invalid RevenueCat webhook payload.');
    }
  }

  private extractRevenueCatEvent(payload: RevenueCatWebhookPayload): RevenueCatEvent | null {
    const event = payload.event ?? (payload as Record<string, unknown>);
    const eventId =
      this.stringValue(event.id) ??
      this.stringValue(event.event_id) ??
      this.stringValue(event.eventId) ??
      this.stringValue(event.transaction_id) ??
      this.stringValue(event.store_transaction_id);
    const type = this.stringValue(event.type);
    const appUserId =
      this.uuidValue(event.app_user_id) ??
      this.uuidValue(event.appUserId) ??
      this.uuidValue(event.original_app_user_id) ??
      this.uuidValue(event.originalAppUserId);
    const productId =
      this.stringValue(event.product_id) ??
      this.stringValue(event.productId) ??
      this.stringValue(event.product_identifier) ??
      this.stringValue(event.productIdentifier);

    if (!eventId || !type || !appUserId || !productId) {
      return null;
    }

    const amount = this.decimalValue(event.price ?? event.price_in_purchased_currency ?? event.amount);

    return {
      eventId,
      type,
      appUserId,
      productId,
      transactionId:
        this.stringValue(event.transaction_id) ??
        this.stringValue(event.store_transaction_id) ??
        this.stringValue(event.original_transaction_id),
      amount,
      currency: this.currencyValue(event.currency ?? event.currency_code ?? event.currencyCode),
    };
  }

  private isRevenueCatConfigured() {
    return Boolean(this.config.get<string>('REVENUECAT_API_KEY')?.trim());
  }

  private isMockPurchasesEnabled() {
    return parseBooleanEnv(this.config.get<string>('ALLOW_MOCK_PURCHASES'));
  }

  private stringValue(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private uuidValue(value: unknown) {
    const text = this.stringValue(value);
    return text && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(text)
      ? text
      : undefined;
  }

  private decimalValue(value: unknown) {
    if (typeof value !== 'number' && typeof value !== 'string') {
      return undefined;
    }

    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 ? new Prisma.Decimal(amount) : undefined;
  }

  private currencyValue(value: unknown) {
    const currency = this.stringValue(value)?.toUpperCase();
    return currency && /^[A-Z]{3}$/.test(currency) ? currency : undefined;
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

  private toPayment(payment: PaymentWithPackage) {
    return {
      id: payment.id,
      userId: payment.userId,
      tokenPackageId: payment.tokenPackageId,
      provider: payment.provider,
      platform: payment.platform,
      platformProductId: payment.platformProductId,
      revenueCatEventId: payment.revenueCatEventId,
      revenueCatTransactionId: payment.revenueCatTransactionId,
      amount: payment.amount.toString(),
      currency: payment.currency,
      status: payment.status,
      failureReason: payment.failureReason,
      tokenPackage: {
        id: payment.tokenPackage.id,
        title: payment.tokenPackage.title,
        tokenCount: payment.tokenPackage.tokenCount,
        price: payment.tokenPackage.price.toString(),
        currency: payment.tokenPackage.currency,
        isActive: payment.tokenPackage.isActive,
        createdAt: payment.tokenPackage.createdAt,
        updatedAt: payment.tokenPackage.updatedAt,
      },
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}
