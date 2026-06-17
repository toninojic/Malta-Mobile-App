import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentProvider,
  PaymentStatus,
  Prisma,
  StorePlatform,
  TokenTransactionType,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PaginatedResponse, PaginationQueryDto, paginationMeta } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

const paymentInclude = {
  tokenPackage: true,
};

const REVENUECAT_PURCHASE_EVENT_TYPES = new Set(['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE']);
const REVENUECAT_PRODUCT_TOKEN_COUNTS: Record<string, number> = {
  maltapro_tokens_5: 5,
  maltapro_tokens_20: 20,
  maltapro_tokens_50: 50,
};
const REVENUECAT_WEBHOOK_DIAGNOSTIC_VERSION = '2026-06-17-user-lookup-v2';

type PaymentWithPackage = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;

type RevenueCatWebhookPayload = {
  event?: Record<string, unknown>;
};

type RevenueCatEvent = {
  eventId: string;
  type: string;
  appUserId: string;
  originalAppUserId?: string;
  aliases: string[];
  productId: string;
  transactionId?: string;
  amount?: Prisma.Decimal;
  currency?: string;
  store?: string;
  environment?: string;
  subscriberEmail?: string;
};

type RevenueCatWebhookUser = {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
};

type RevenueCatUserLookupDiagnostics = {
  diagnosticVersion: string;
  appUserId: string;
  originalAppUserId?: string;
  aliases: string[];
  subscriberEmail?: string;
  queryUsed: string[];
  userFound: boolean;
  matchedBy?: string;
  matchedUserId?: string;
  matchedUserEmail?: string;
  productId: string;
  eventType: string;
  currentDatabase?: string;
  currentSchema?: string;
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
      return {
        received: true,
        ignored: true,
        reason: 'MALFORMED_EVENT',
        diagnosticVersion: REVENUECAT_WEBHOOK_DIAGNOSTIC_VERSION,
      };
    }

    this.logger.log(
      `RevenueCat webhook event received diagnostic_version=${REVENUECAT_WEBHOOK_DIAGNOSTIC_VERSION} type=${event.type} product_id=${event.productId} transaction_id=${event.transactionId ?? 'missing'} app_user_id=${event.appUserId} original_app_user_id=${event.originalAppUserId ?? 'missing'} aliases=${event.aliases.join('|') || 'none'} subscriber_email_present=${Boolean(event.subscriberEmail)} store=${event.store ?? 'unknown'} environment=${event.environment ?? 'unknown'}`,
    );

    if (!REVENUECAT_PURCHASE_EVENT_TYPES.has(event.type)) {
      this.logger.log(
        `RevenueCat webhook ignored unsupported event type=${event.type} product_id=${event.productId} transaction_id=${event.transactionId ?? 'missing'} app_user_id=${event.appUserId}`,
      );
      return {
        received: true,
        ignored: true,
        reason: 'UNSUPPORTED_EVENT_TYPE',
        eventType: event.type,
        diagnosticVersion: REVENUECAT_WEBHOOK_DIAGNOSTIC_VERSION,
      };
    }

    const result = await this.processRevenueCatPurchase(event);
    return { received: true, diagnosticVersion: REVENUECAT_WEBHOOK_DIAGNOSTIC_VERSION, ...result };
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

    if (existingPayment) {
      this.logger.log(
        `RevenueCat duplicate detected yes transaction_id=${event.transactionId ?? 'missing'} event_id=${event.eventId} payment_id=${existingPayment.id} status=${existingPayment.status}`,
      );
      return {
        duplicate: true,
        paymentId: existingPayment.id,
        granted: existingPayment.status === PaymentStatus.COMPLETED || existingPayment.status === PaymentStatus.PAID,
      };
    }

    this.logger.log(
      `RevenueCat duplicate detected no transaction_id=${event.transactionId ?? 'missing'} event_id=${event.eventId}`,
    );

    const userLookup = await this.resolveRevenueCatUser(event);
    const user = userLookup.user;
    this.logger.log(
      `RevenueCat user lookup diagnostics diagnostic_version=${userLookup.diagnostics.diagnosticVersion} app_user_id=${userLookup.diagnostics.appUserId} user_found=${userLookup.diagnostics.userFound} matched_by=${userLookup.diagnostics.matchedBy ?? 'none'} product_id=${userLookup.diagnostics.productId} event_type=${userLookup.diagnostics.eventType} query_used=${userLookup.diagnostics.queryUsed.join(' -> ') || 'none'} current_database=${userLookup.diagnostics.currentDatabase ?? 'unknown'} current_schema=${userLookup.diagnostics.currentSchema ?? 'unknown'}`,
    );

    if (!user) {
      this.logger.warn(
        `RevenueCat user lookup failed diagnostic_version=${userLookup.diagnostics.diagnosticVersion} app_user_id=${event.appUserId} original_app_user_id=${event.originalAppUserId ?? 'missing'} product_id=${event.productId} event_type=${event.type} query_used=${userLookup.diagnostics.queryUsed.join(' -> ')} current_database=${userLookup.diagnostics.currentDatabase ?? 'unknown'} current_schema=${userLookup.diagnostics.currentSchema ?? 'unknown'}`,
      );
      return { ignored: true, reason: 'UNKNOWN_USER', diagnostics: userLookup.diagnostics };
    }

    this.logger.log(
      `RevenueCat matched user yes diagnostic_version=${userLookup.diagnostics.diagnosticVersion} matched_by=${userLookup.diagnostics.matchedBy ?? 'unknown'} user_id=${user.id} email=${user.email} role=${user.role} status=${user.status} product_id=${event.productId} transaction_id=${event.transactionId ?? 'missing'}`,
    );

    if (user.role !== UserRole.CONTRACTOR) {
      this.logger.warn(`Ignored RevenueCat purchase for non-contractor user_id=${event.appUserId} product_id=${event.productId} transaction_id=${event.transactionId ?? 'missing'}.`);
      return { ignored: true, reason: 'INVALID_USER_ROLE' };
    }

    const storeProduct = await this.resolveRevenueCatStoreProduct(event.productId);

    if (!storeProduct) {
      this.logger.warn(`Ignored RevenueCat purchase for unknown product_id=${event.productId} transaction_id=${event.transactionId ?? 'missing'} app_user_id=${event.appUserId}.`);
      return { ignored: true, reason: 'UNKNOWN_PRODUCT' };
    }

    let payment: PaymentWithPackage;

    try {
      payment = await this.prisma.$transaction(async (tx) => {
        const existingInsideTransaction = await tx.payment.findFirst({
          where: {
            OR: [
              { revenueCatEventId: event.eventId },
              ...(event.transactionId ? [{ revenueCatTransactionId: event.transactionId }] : []),
            ],
          },
          include: paymentInclude,
        });

        if (existingInsideTransaction) {
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
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        const duplicatePayment = await this.prisma.payment.findFirst({
          where: {
            OR: [
              { revenueCatEventId: event.eventId },
              ...(event.transactionId ? [{ revenueCatTransactionId: event.transactionId }] : []),
            ],
          },
          include: paymentInclude,
        });

        if (duplicatePayment) {
          this.logger.log(
            `RevenueCat duplicate detected yes transaction_id=${event.transactionId ?? 'missing'} event_id=${event.eventId} payment_id=${duplicatePayment.id} status=${duplicatePayment.status}`,
          );
          return {
            duplicate: true,
            granted: duplicatePayment.status === PaymentStatus.COMPLETED || duplicatePayment.status === PaymentStatus.PAID,
            paymentId: duplicatePayment.id,
          };
        }
      }

      throw error;
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      this.logger.log(
        `RevenueCat credited tokens user_id=${user.id} product_id=${event.productId} transaction_id=${event.transactionId ?? 'missing'} amount=${storeProduct.tokenPackage.tokenCount} payment_id=${payment.id}`,
      );
    } else {
      this.logger.log(
        `RevenueCat duplicate transaction returned existing payment user_id=${user.id} product_id=${event.productId} transaction_id=${event.transactionId ?? 'missing'} payment_id=${payment.id} status=${payment.status}`,
      );
    }

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
    const event = this.objectValue(payload.event) ?? (payload as Record<string, unknown>);
    const transactionId =
      this.stringValue(event.transaction_id) ??
      this.stringValue(event.store_transaction_id) ??
      this.stringValue(event.original_transaction_id) ??
      this.stringValue(event.transactionId) ??
      this.stringValue(event.originalTransactionId);
    const eventId =
      this.stringValue(event.id) ??
      this.stringValue(event.event_id) ??
      this.stringValue(event.eventId) ??
      transactionId;
    const type = this.stringValue(event.type);
    const aliases = this.stringArrayValue(event.aliases);
    const originalAppUserId =
      this.stringValue(event.original_app_user_id) ??
      this.stringValue(event.originalAppUserId);
    const appUserId =
      this.stringValue(event.app_user_id) ??
      this.stringValue(event.appUserId) ??
      originalAppUserId ??
      aliases[0];
    const productId =
      this.stringValue(event.product_id) ??
      this.stringValue(event.productId) ??
      this.stringValue(event.product_identifier) ??
      this.stringValue(event.productIdentifier);

    if (!eventId || !type || !appUserId || !productId) {
      this.logger.warn(
        `Malformed RevenueCat event missing required fields has_event=${Boolean(payload.event)} event_id_present=${Boolean(eventId)} type_present=${Boolean(type)} app_user_id_present=${Boolean(appUserId)} product_id_present=${Boolean(productId)} keys=${Object.keys(event).join(',')}`,
      );
      return null;
    }

    const amount = this.decimalValue(event.price ?? event.price_in_purchased_currency ?? event.amount);

    return {
      eventId,
      type,
      appUserId,
      originalAppUserId,
      aliases,
      productId,
      transactionId,
      amount,
      currency: this.currencyValue(event.currency ?? event.currency_code ?? event.currencyCode),
      store: this.stringValue(event.store),
      environment: this.stringValue(event.environment),
      subscriberEmail: this.revenueCatSubscriberEmail(event),
    };
  }

  private async resolveRevenueCatUser(event: RevenueCatEvent) {
    const diagnostics: RevenueCatUserLookupDiagnostics = {
      diagnosticVersion: REVENUECAT_WEBHOOK_DIAGNOSTIC_VERSION,
      appUserId: event.appUserId,
      originalAppUserId: event.originalAppUserId,
      aliases: event.aliases,
      subscriberEmail: event.subscriberEmail,
      queryUsed: [],
      userFound: false,
      productId: event.productId,
      eventType: event.type,
    };

    const databaseContext = await this.databaseContext();
    diagnostics.currentDatabase = databaseContext.currentDatabase;
    diagnostics.currentSchema = databaseContext.currentSchema;

    const candidateIds = [event.appUserId, event.originalAppUserId, ...event.aliases]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.trim())
      .filter(Boolean);
    const uniqueCandidateIds = [...new Set(candidateIds)];

    for (const candidateId of uniqueCandidateIds) {
      if (!this.isUuidValue(candidateId)) {
        diagnostics.queryUsed.push(`skipped non-uuid candidate ${candidateId}`);
        continue;
      }

      diagnostics.queryUsed.push(`Prisma User.id = ${candidateId}`);
      const prismaUser = await this.prisma.user.findUnique({
        where: { id: candidateId },
        select: { id: true, email: true, role: true, status: true },
      });

      if (prismaUser) {
        this.markUserFound(diagnostics, 'prisma_user_id', prismaUser);
        return { user: prismaUser, diagnostics };
      }

      diagnostics.queryUsed.push(`SQL "User"."id" = ${candidateId}::uuid`);
      const rawUser = await this.findUserByIdRaw(candidateId);

      if (rawUser) {
        this.markUserFound(diagnostics, 'raw_sql_user_id', rawUser);
        return { user: rawUser, diagnostics };
      }
    }

    if (event.subscriberEmail) {
      diagnostics.queryUsed.push(`Prisma User.email = ${event.subscriberEmail}`);
      const emailUser = await this.prisma.user.findUnique({
        where: { email: event.subscriberEmail },
        select: { id: true, email: true, role: true, status: true },
      });

      if (emailUser) {
        this.markUserFound(diagnostics, 'subscriber_email', emailUser);
        return { user: emailUser, diagnostics };
      }
    }

    return { user: null, diagnostics };
  }

  private markUserFound(
    diagnostics: RevenueCatUserLookupDiagnostics,
    matchedBy: string,
    user: RevenueCatWebhookUser,
  ) {
    diagnostics.userFound = true;
    diagnostics.matchedBy = matchedBy;
    diagnostics.matchedUserId = user.id;
    diagnostics.matchedUserEmail = user.email;
  }

  private async findUserByIdRaw(userId: string) {
    const users = await this.prisma.$queryRaw<RevenueCatWebhookUser[]>`
      SELECT
        "id"::text AS "id",
        "email",
        "role"::text AS "role",
        "status"::text AS "status"
      FROM "User"
      WHERE "id" = ${userId}::uuid
      LIMIT 1
    `;

    return users[0] ?? null;
  }

  private async databaseContext(): Promise<{ currentDatabase?: string; currentSchema?: string }> {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ currentDatabase: string; currentSchema: string }>>`
        SELECT
          current_database() AS "currentDatabase",
          current_schema() AS "currentSchema"
      `;

      return rows[0] ?? {};
    } catch {
      return {};
    }
  }

  private async resolveRevenueCatStoreProduct(productId: string) {
    const existingStoreProduct = await this.prisma.storeProduct.findFirst({
      where: {
        platformProductId: productId,
        platform: StorePlatform.REVENUECAT,
        isActive: true,
        tokenPackage: { isActive: true },
      },
      include: { tokenPackage: true },
    });

    if (existingStoreProduct) {
      this.logger.log(
        `RevenueCat product mapping found product_id=${productId} token_package_id=${existingStoreProduct.tokenPackageId} tokens=${existingStoreProduct.tokenPackage.tokenCount}`,
      );
      return existingStoreProduct;
    }

    const tokenCount = REVENUECAT_PRODUCT_TOKEN_COUNTS[productId];

    if (!tokenCount) {
      return null;
    }

    const tokenPackage = await this.prisma.tokenPackage.findFirst({
      where: {
        tokenCount,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!tokenPackage) {
      this.logger.warn(`RevenueCat product mapping missing token package product_id=${productId} expected_tokens=${tokenCount}.`);
      return null;
    }

    const storeProduct = await this.prisma.storeProduct.upsert({
      where: {
        platform_platformProductId: {
          platform: StorePlatform.REVENUECAT,
          platformProductId: productId,
        },
      },
      create: {
        platform: StorePlatform.REVENUECAT,
        platformProductId: productId,
        tokenPackageId: tokenPackage.id,
        isActive: true,
      },
      update: {
        tokenPackageId: tokenPackage.id,
        isActive: true,
      },
      include: { tokenPackage: true },
    });

    this.logger.log(
      `RevenueCat product mapping repaired product_id=${productId} token_package_id=${storeProduct.tokenPackageId} tokens=${storeProduct.tokenPackage.tokenCount}`,
    );

    return storeProduct;
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

  private objectValue(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
  }

  private stringArrayValue(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    const values: string[] = [];

    for (const item of value) {
      const text = this.stringValue(item);

      if (text) {
        values.push(text);
      }
    }

    return values;
  }

  private revenueCatSubscriberEmail(event: Record<string, unknown>) {
    const directEmail =
      this.stringValue(event.email) ??
      this.stringValue(event.subscriber_email) ??
      this.stringValue(event.subscriberEmail) ??
      this.stringValue(event.customer_email) ??
      this.stringValue(event.customerEmail);

    if (directEmail) {
      return this.emailValue(directEmail);
    }

    const subscriberAttributes =
      this.objectValue(event.subscriber_attributes) ??
      this.objectValue(event.subscriberAttributes);
    const emailAttribute =
      this.objectValue(subscriberAttributes?.$email) ??
      this.objectValue(subscriberAttributes?.email);
    const attributeEmail =
      this.stringValue(emailAttribute?.value) ??
      this.stringValue(emailAttribute);

    return attributeEmail ? this.emailValue(attributeEmail) : undefined;
  }

  private emailValue(value: string) {
    const email = value.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
  }

  private isUuidValue(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
  }

  private isUniqueConstraintError(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
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
