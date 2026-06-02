import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ConversationsService } from './conversations.service';

@Controller({
  path: 'conversations',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYER, UserRole.CONTRACTOR)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @Throttle({ default: { limit: 180, ttl: 60_000 } })
  findMine(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.conversationsService.findMine(user, query);
  }

  @Get(':id')
  @Throttle({ default: { limit: 180, ttl: 60_000 } })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.conversationsService.findOne(user, id);
  }

  @Post('contacts/:contactId')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  ensureForContact(@CurrentUser() user: AuthenticatedUser, @Param('contactId', ParseUUIDPipe) contactId: string) {
    return this.conversationsService.ensureForContact(user, contactId);
  }
}
