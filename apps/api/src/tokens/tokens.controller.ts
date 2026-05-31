import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CreateRefundRequestDto } from './dto/create-refund-request.dto';
import { MockPurchaseDto } from './dto/mock-purchase.dto';
import { RefundsQueryDto } from './dto/refunds-query.dto';
import { TokensService } from './tokens.service';

@Controller({
  path: 'tokens',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYER, UserRole.CONTRACTOR, UserRole.ADMIN)
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Get('packages')
  packages() {
    return this.tokensService.findActivePackages();
  }

  @Get('balance')
  balance(@CurrentUser() user: AuthenticatedUser) {
    return this.tokensService.getBalance(user);
  }

  @Get('transactions')
  transactions(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.tokensService.findTransactions(user, query);
  }

  @Post('mock-purchase')
  mockPurchase(@CurrentUser() user: AuthenticatedUser, @Body() dto: MockPurchaseDto) {
    return this.tokensService.mockPurchase(user, dto);
  }

  @Post('refunds')
  createRefund(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRefundRequestDto) {
    return this.tokensService.createRefundRequest(user, dto);
  }

  @Get('refunds/mine')
  myRefunds(@CurrentUser() user: AuthenticatedUser, @Query() query: RefundsQueryDto) {
    return this.tokensService.findMyRefunds(user, query);
  }
}
