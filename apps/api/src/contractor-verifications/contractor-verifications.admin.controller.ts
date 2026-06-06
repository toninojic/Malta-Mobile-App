import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ContractorVerificationsService } from './contractor-verifications.service';
import { RejectVerificationDto } from './dto/reject-verification.dto';

@Controller({
  path: 'admin/contractor-verifications',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ContractorVerificationsAdminController {
  constructor(private readonly contractorVerificationsService: ContractorVerificationsService) {}

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.contractorVerificationsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.contractorVerificationsService.findOne(id);
  }

  @Post(':id/approve')
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.contractorVerificationsService.approve(user, id);
  }

  @Post(':id/reject')
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectVerificationDto,
  ) {
    return this.contractorVerificationsService.reject(user, id, dto.adminNote);
  }
}
