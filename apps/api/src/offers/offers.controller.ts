import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CreateOfferDto } from './dto/create-offer.dto';
import { OffersQueryDto } from './dto/offers-query.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { OffersService } from './offers.service';

@Controller({
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Post('jobs/:jobId/offers')
  @Roles(UserRole.CONTRACTOR)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() dto: CreateOfferDto,
  ) {
    return this.offersService.create(user, jobId, dto);
  }

  @Get('jobs/:jobId/offers')
  @Roles(UserRole.EMPLOYER)
  findForJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Query() query: OffersQueryDto,
  ) {
    return this.offersService.findForJob(user, jobId, query);
  }

  @Get('offers')
  @Roles(UserRole.ADMIN)
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: OffersQueryDto) {
    return this.offersService.findAll(user, query);
  }

  @Get('offers/mine')
  @Roles(UserRole.CONTRACTOR)
  mine(@CurrentUser() user: AuthenticatedUser, @Query() query: OffersQueryDto) {
    return this.offersService.findMine(user, query);
  }

  @Get('offers/:offerId')
  @Roles(UserRole.ADMIN)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('offerId', ParseUUIDPipe) offerId: string) {
    return this.offersService.findOneAdmin(user, offerId);
  }

  @Patch('offers/:offerId')
  @Roles(UserRole.CONTRACTOR)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: UpdateOfferDto,
  ) {
    return this.offersService.update(user, offerId, dto);
  }

  @Post('offers/:offerId/select')
  @Roles(UserRole.EMPLOYER)
  select(@CurrentUser() user: AuthenticatedUser, @Param('offerId', ParseUUIDPipe) offerId: string) {
    return this.offersService.select(user, offerId);
  }

  @Post('offers/:offerId/withdraw')
  @Roles(UserRole.CONTRACTOR)
  withdraw(@CurrentUser() user: AuthenticatedUser, @Param('offerId', ParseUUIDPipe) offerId: string) {
    return this.offersService.withdraw(user, offerId);
  }
}
