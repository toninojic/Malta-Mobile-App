import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { AdminRefundDecisionDto } from './dto/admin-refund-decision.dto';
import { CreateTokenPackageDto } from './dto/create-token-package.dto';
import { RefundsQueryDto } from './dto/refunds-query.dto';
import { UpdateTokenPackageDto } from './dto/update-token-package.dto';
import { TokensService } from './tokens.service';

@Controller({
  path: 'admin/tokens',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminTokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Post('packages')
  createPackage(@Body() dto: CreateTokenPackageDto) {
    return this.tokensService.createPackage(dto);
  }

  @Patch('packages/:id')
  updatePackage(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTokenPackageDto) {
    return this.tokensService.updatePackage(id, dto);
  }

  @Get('refunds')
  refunds(@Query() query: RefundsQueryDto) {
    return this.tokensService.findAdminRefunds(query);
  }

  @Post('refunds/:refundRequestId/approve')
  approveRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('refundRequestId', ParseUUIDPipe) refundRequestId: string,
    @Body() dto: AdminRefundDecisionDto,
  ) {
    return this.tokensService.approveRefund(user, refundRequestId, dto);
  }

  @Post('refunds/:refundRequestId/reject')
  rejectRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('refundRequestId', ParseUUIDPipe) refundRequestId: string,
    @Body() dto: AdminRefundDecisionDto,
  ) {
    return this.tokensService.rejectRefund(user, refundRequestId, dto);
  }
}
