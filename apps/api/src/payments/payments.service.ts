import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus, Prisma, TokenTransactionType, UserRole } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaginatedResponse, PaginationQueryDto, paginationMeta } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

const paymentInclude = {
  tokenPackage: true,
};

const LOCAL_WEBHOOK_SECRET = 'whsec_milestone8_local_dev';
const STRIPE_CHECKOUT_SESSION_URL = 'https://api.stripe.com/v1/checkout/sessions';

type PaymentWithPackage = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;

type StripeCheckoutSessionResponse = {
  id?: unknown;
  url?: unknown;
  payment_intent?: unknown;
  error?: {
    message?: unknown;
  };
};

type StripeEvent = {
  id?: unknown;
  type?: unknown;
  data?: {
    object?: unknown;
  };
};

type StripeCheckoutSessionEvent = {
  id?: unknown;
  payment_intent?: unknown;
  metadata?: Record<string, string>;
};

type StripePaymentIntentEvent = {
  id?: unknown;
  metadata?: Record<string, string>;
  last_payment_error?: {
    message?: unknown;
  } | null;
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  getConfig() {
    const mockPurchasesEnabled = this.isMockPurchasesEnabled();
    const stripeConfigured = this.isStripeConfigured();

    return {
      mode: mockPurchasesEnabled ? 'MOCK' : 'STRIPE',
      allowMockPurchases: mockPurchasesEnabled,
      mockPurchasesEnabled,
      stripeConfigured,
    };
  }

  async createCheckoutSession(user: AuthenticatedUser, dto: CreateCheckoutSessionDto) {
    if (user.role !== UserRole.CONTRACTOR) {
      throw new ForbiddenException('Only contractors can purchase token packages.');
    }

    const secretKey = this.getStripeSecretKey();
    const tokenPackage = await this.prisma.tokenPackage.findUnique({
      where: { id: dto.tokenPackageId },
    });

    if (!tokenPackage) {
      throw new NotFoundException('Token package not found.');
    }

    if (!tokenPackage.isActive) {
      throw new BadRequestException('Token package is inactive.');
    }

    const payment = await this.prisma.payment.create({
      data: {
        userId: user.id,
        tokenPackageId: tokenPackage.id,
        amount: tokenPackage.price,
        currency: tokenPackage.currency,
        status: PaymentStatus.PENDING,
      },
      include: paymentInclude,
    });

    try {
      const checkoutSession = await this.createStripeCheckoutSession(secretKey, user, payment, tokenPackage);
      const checkoutSessionId = this.stringValue(checkoutSession.id);
      const checkoutUrl = this.stringValue(checkoutSession.url);

      if (!checkoutSessionId || !checkoutUrl) {
        throw new BadRequestException('Stripe did not return a checkout session URL.');
      }

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          stripeCheckoutSessionId: checkoutSessionId,
        },
      });

      return {
        checkoutUrl,
        paymentId: payment.id,
        status: payment.status,
      };
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          failureReason: error instanceof Error ? error.message : 'Could not create Stripe checkout session.',
        },
      });

      throw error;
    }
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

  async handleWebhook(signature: string | undefined, rawBody: Buffer) {
    this.verifyWebhookSignature(signature, rawBody);

    const event = this.parseEvent(rawBody);

    if (event.type === 'checkout.session.completed') {
      await this.handleCheckoutSessionCompleted(event.data?.object);
    }

    if (event.type === 'payment_intent.payment_failed') {
      await this.handlePaymentIntentFailed(event.data?.object);
    }

    return { received: true };
  }

  private async createStripeCheckoutSession(
    secretKey: string,
    user: AuthenticatedUser,
    payment: PaymentWithPackage,
    tokenPackage: PaymentWithPackage['tokenPackage'],
  ) {
    const successUrl = this.config.get<string>('STRIPE_SUCCESS_URL') ?? `maltacraftsman://payment-success?paymentId=${payment.id}`;
    const cancelUrl = this.config.get<string>('STRIPE_CANCEL_URL') ?? `maltacraftsman://payment-pending?paymentId=${payment.id}`;
    const metadata = {
      paymentId: payment.id,
      userId: user.id,
      tokenPackageId: tokenPackage.id,
    };

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', successUrl);
    params.append('cancel_url', cancelUrl);
    params.append('line_items[0][price_data][currency]', tokenPackage.currency.toLowerCase());
    params.append('line_items[0][price_data][unit_amount]', String(this.toMinorUnits(tokenPackage.price)));
    params.append('line_items[0][price_data][product_data][name]', `${tokenPackage.title} token package`);
    params.append('line_items[0][quantity]', '1');

    Object.entries(metadata).forEach(([key, value]) => {
      params.append(`metadata[${key}]`, value);
      params.append(`payment_intent_data[metadata][${key}]`, value);
    });

    const response = await fetch(STRIPE_CHECKOUT_SESSION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const payload = (await response.json().catch(() => ({}))) as StripeCheckoutSessionResponse;

    if (!response.ok) {
      throw new BadRequestException(this.stringValue(payload.error?.message) ?? 'Stripe checkout session failed.');
    }

    return payload;
  }

  private async handleCheckoutSessionCompleted(object: unknown) {
    const session = object as StripeCheckoutSessionEvent;
    const checkoutSessionId = this.stringValue(session.id);
    const paymentId = this.uuidValue(session.metadata?.paymentId);
    const stripePaymentIntentId = this.stringValue(session.payment_intent);

    if (!checkoutSessionId && !paymentId) {
      throw new BadRequestException('Stripe checkout session is missing payment metadata.');
    }

    const payment = await this.findWebhookPayment({
      paymentId,
      checkoutSessionId,
    });

    if (!payment) {
      throw new NotFoundException('Payment not found for Stripe checkout session.');
    }

    await this.prisma.$transaction(async (tx) => {
      const update = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] },
        },
        data: {
          status: PaymentStatus.PAID,
          stripeCheckoutSessionId: checkoutSessionId ?? payment.stripeCheckoutSessionId,
          stripePaymentIntentId: stripePaymentIntentId ?? payment.stripePaymentIntentId,
          failureReason: null,
        },
      });

      if (update.count !== 1) {
        return;
      }

      await this.ensureWallet(payment.userId, tx);
      const wallet = await tx.userTokenBalance.update({
        where: { userId: payment.userId },
        data: {
          balance: { increment: payment.tokenPackage.tokenCount },
          version: { increment: 1 },
        },
      });

      await tx.tokenTransaction.create({
        data: {
          userId: payment.userId,
          packageId: payment.tokenPackageId,
          type: TokenTransactionType.PURCHASE,
          amount: payment.tokenPackage.tokenCount,
          balanceAfter: wallet.balance,
          description: `Stripe purchase: ${payment.tokenPackage.title}`,
          externalRef: checkoutSessionId ?? payment.id,
        },
      });
    });
  }

  private async handlePaymentIntentFailed(object: unknown) {
    const paymentIntent = object as StripePaymentIntentEvent;
    const stripePaymentIntentId = this.stringValue(paymentIntent.id);
    const paymentId = this.uuidValue(paymentIntent.metadata?.paymentId);

    if (!stripePaymentIntentId && !paymentId) {
      throw new BadRequestException('Stripe payment intent is missing payment metadata.');
    }

    const payment = await this.findWebhookPayment({
      paymentId,
      paymentIntentId: stripePaymentIntentId,
    });

    if (!payment) {
      throw new NotFoundException('Payment not found for Stripe payment intent.');
    }

    if (payment.status === PaymentStatus.PAID || payment.status === PaymentStatus.REFUNDED) {
      return;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        stripePaymentIntentId: stripePaymentIntentId ?? payment.stripePaymentIntentId,
        failureReason: this.stringValue(paymentIntent.last_payment_error?.message) ?? 'Stripe payment failed.',
      },
    });
  }

  private async findWebhookPayment(input: {
    paymentId?: string;
    checkoutSessionId?: string;
    paymentIntentId?: string;
  }) {
    const or: Prisma.PaymentWhereInput[] = [];

    if (input.paymentId) {
      or.push({ id: input.paymentId });
    }

    if (input.checkoutSessionId) {
      or.push({ stripeCheckoutSessionId: input.checkoutSessionId });
    }

    if (input.paymentIntentId) {
      or.push({ stripePaymentIntentId: input.paymentIntentId });
    }

    if (!or.length) {
      return null;
    }

    return this.prisma.payment.findFirst({
      where: { OR: or },
      include: paymentInclude,
    });
  }

  private verifyWebhookSignature(signature: string | undefined, rawBody: Buffer) {
    if (!signature) {
      throw new BadRequestException('Missing Stripe webhook signature.');
    }

    const timestamp = this.signaturePart(signature, 't');
    const signatures = this.signatureParts(signature, 'v1');
    const parsedTimestamp = Number(timestamp);

    if (!timestamp || !Number.isFinite(parsedTimestamp) || signatures.length === 0) {
      throw new BadRequestException('Invalid Stripe webhook signature.');
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowInSeconds - parsedTimestamp) > 300) {
      throw new BadRequestException('Expired Stripe webhook signature.');
    }

    const secret = this.getStripeWebhookSecret();
    const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest('hex');
    const matches = signatures.some((candidate) => this.safeCompareHex(expected, candidate));

    if (!matches) {
      throw new BadRequestException('Invalid Stripe webhook signature.');
    }
  }

  private parseEvent(rawBody: Buffer): StripeEvent {
    try {
      return JSON.parse(rawBody.toString('utf8')) as StripeEvent;
    } catch {
      throw new BadRequestException('Invalid Stripe webhook payload.');
    }
  }

  private signaturePart(signature: string, key: string) {
    return this.signatureParts(signature, key)[0];
  }

  private signatureParts(signature: string, key: string) {
    return signature.split(',').flatMap((part) => {
      const separatorIndex = part.indexOf('=');

      if (separatorIndex === -1) {
        return [];
      }

      const partKey = part.slice(0, separatorIndex);
      const value = part.slice(separatorIndex + 1);
      return partKey === key && value ? [value] : [];
    });
  }

  private safeCompareHex(expected: string, candidate: string) {
    const expectedBuffer = Buffer.from(expected, 'hex');
    const candidateBuffer = Buffer.from(candidate, 'hex');

    return expectedBuffer.length === candidateBuffer.length && timingSafeEqual(expectedBuffer, candidateBuffer);
  }

  private getStripeSecretKey() {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');

    if (!secretKey || !secretKey.startsWith('sk_test_')) {
      throw new ServiceUnavailableException('Payments are not configured.');
    }

    return secretKey;
  }

  private isStripeConfigured() {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    return Boolean(secretKey?.startsWith('sk_test_'));
  }

  private isMockPurchasesEnabled() {
    return this.config.get<string>('ALLOW_MOCK_PURCHASES') === 'true';
  }

  private getStripeWebhookSecret() {
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');

    if (webhookSecret) {
      if (!webhookSecret.startsWith('whsec_')) {
        throw new ServiceUnavailableException('Stripe webhook secret is invalid.');
      }

      return webhookSecret;
    }

    if (this.config.get<string>('NODE_ENV') !== 'production') {
      return LOCAL_WEBHOOK_SECRET;
    }

    throw new ServiceUnavailableException('Stripe webhook secret is not configured.');
  }

  private toMinorUnits(amount: Prisma.Decimal) {
    return Math.round(Number(amount) * 100);
  }

  private stringValue(value: unknown) {
    return typeof value === 'string' && value.trim() ? value : undefined;
  }

  private uuidValue(value: unknown) {
    const text = this.stringValue(value);
    return text && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
      ? text
      : undefined;
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
      stripeCheckoutSessionId: payment.stripeCheckoutSessionId,
      stripePaymentIntentId: payment.stripePaymentIntentId,
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
