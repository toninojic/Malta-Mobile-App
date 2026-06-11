import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ContactsService } from './contacts.service';

@Controller({
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post('offers/:offerId/unlock')
  @Roles(UserRole.CONTRACTOR)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  unlockOffer(@CurrentUser() user: AuthenticatedUser, @Param('offerId', ParseUUIDPipe) offerId: string) {
    return this.contactsService.unlockOffer(user, offerId);
  }

  @Post('offers/:offerId/request-contact')
  @Roles(UserRole.EMPLOYER)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  requestContact(@CurrentUser() user: AuthenticatedUser, @Param('offerId', ParseUUIDPipe) offerId: string) {
    return this.contactsService.requestContact(user, offerId);
  }

  @Get('offers/:offerId/unlock-status')
  @Roles(UserRole.EMPLOYER, UserRole.CONTRACTOR)
  @Throttle({ default: { limit: 180, ttl: 60_000 } })
  unlockStatus(@CurrentUser() user: AuthenticatedUser, @Param('offerId', ParseUUIDPipe) offerId: string) {
    return this.contactsService.getUnlockStatus(user, offerId);
  }

  @Get('contacts')
  @Roles(UserRole.EMPLOYER, UserRole.CONTRACTOR)
  @Throttle({ default: { limit: 180, ttl: 60_000 } })
  contacts(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.contactsService.findContacts(user, query);
  }

  @Get('contacts/reviews-to-leave')
  @Roles(UserRole.EMPLOYER, UserRole.CONTRACTOR)
  @Throttle({ default: { limit: 180, ttl: 60_000 } })
  contactsReadyForReview(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.contactsService.findContactsReadyForReview(user, query);
  }

  @Get('contacts/:contactId')
  @Roles(UserRole.EMPLOYER, UserRole.CONTRACTOR)
  @Throttle({ default: { limit: 180, ttl: 60_000 } })
  contact(@CurrentUser() user: AuthenticatedUser, @Param('contactId', ParseUUIDPipe) contactId: string) {
    return this.contactsService.findContact(user, contactId);
  }
}
