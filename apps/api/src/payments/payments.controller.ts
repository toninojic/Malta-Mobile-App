import { Body, Controller, Get, Headers, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { PaymentsService } from './payments.service';

type RequestWithRawBody = Request & {
  rawBody?: Buffer;
  body?: unknown;
};

@Controller({
  path: 'payments',
  version: '1',
})
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.CONTRACTOR, UserRole.ADMIN)
  @Throttle({ default: { limit: 180, ttl: 60_000 } })
  config() {
    return this.paymentsService.getConfig();
  }

  @Post('create-checkout-session')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CONTRACTOR)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  createCheckoutSession(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCheckoutSessionDto) {
    return this.paymentsService.createCheckoutSession(user, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.CONTRACTOR, UserRole.ADMIN)
  @Throttle({ default: { limit: 180, ttl: 60_000 } })
  payments(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.paymentsService.findMine(user, query);
  }

  @Post('webhook')
  @HttpCode(200)
  webhook() {
    return this.paymentsService.handleDeprecatedStripeWebhook();
  }
}

@Controller({
  path: 'purchases',
  version: '1',
})
export class PurchasesController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('revenuecat/webhook')
  @HttpCode(200)
  revenueCatWebhook(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-revenuecat-signature') revenueCatSignature: string | undefined,
    @Headers('x-webhook-secret') webhookSecret: string | undefined,
    @Req() request: RequestWithRawBody,
  ) {
    return this.paymentsService.handleRevenueCatWebhook({
      authorization,
      revenueCatSignature,
      webhookSecret,
      rawBody: request.rawBody ?? Buffer.from(JSON.stringify(request.body ?? {}), 'utf8'),
    });
  }
}
