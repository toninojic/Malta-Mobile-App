import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagesService } from './messages.service';

@Controller({
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('conversations/:id/messages')
  @Roles(UserRole.EMPLOYER, UserRole.CONTRACTOR)
  @Throttle({ default: { limit: 180, ttl: 60_000 } })
  findConversationMessages(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.messagesService.findConversationMessages(user, id);
  }

  @Post('conversations/:id/messages')
  @Roles(UserRole.EMPLOYER, UserRole.CONTRACTOR)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(user, id, dto);
  }

  @Patch('messages/:id/read')
  @Roles(UserRole.EMPLOYER, UserRole.CONTRACTOR)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.messagesService.markRead(user, id);
  }
}
