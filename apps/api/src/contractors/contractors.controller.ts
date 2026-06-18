import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ContractorsService } from './contractors.service';

@Controller({
  path: 'contractors/me',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CONTRACTOR)
export class ContractorsController {
  constructor(private readonly contractorsService: ContractorsService) {}

  @Get('service-areas')
  serviceAreas(@CurrentUser() user: AuthenticatedUser) {
    return this.contractorsService.serviceAreas(user);
  }

  @Patch('service-areas')
  updateServiceAreas(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.contractorsService.updateServiceAreas(user, body);
  }

  @Get('service-categories')
  serviceCategories(@CurrentUser() user: AuthenticatedUser) {
    return this.contractorsService.serviceCategories(user);
  }

  @Patch('service-categories')
  updateServiceCategories(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.contractorsService.updateServiceCategories(user, body);
  }
}
