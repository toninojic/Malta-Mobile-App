import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminService } from './admin.service';
import { AdminOffersQueryDto } from './dto/admin-offers-query.dto';

@Controller({
  path: 'admin/offers',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminOffersController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  offers(@Query() query: AdminOffersQueryDto) {
    return this.adminService.offers(query);
  }

  @Get(':offerId')
  offer(@Param('offerId', ParseUUIDPipe) offerId: string) {
    return this.adminService.offer(offerId);
  }
}
