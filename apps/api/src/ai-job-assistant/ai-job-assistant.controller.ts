import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { AiJobAssistantService } from './ai-job-assistant.service';
import { SendAiMessageDto } from './dto/send-ai-message.dto';

@Controller({
  path: 'ai/job-assistant',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYER)
export class AiJobAssistantController {
  constructor(private readonly aiJobAssistantService: AiJobAssistantService) {}

  @Post('conversations')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  createConversation(@CurrentUser() user: AuthenticatedUser) {
    return this.aiJobAssistantService.createConversation(user);
  }

  @Get('conversations/current')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  currentConversation(@CurrentUser() user: AuthenticatedUser) {
    return this.aiJobAssistantService.currentConversation(user);
  }

  @Post('messages')
  @Throttle({ default: { limit: 25, ttl: 60_000 } })
  sendMessage(@CurrentUser() user: AuthenticatedUser, @Body() dto: SendAiMessageDto) {
    return this.aiJobAssistantService.sendMessage(user, dto);
  }

  @Get('usage')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  usage(@CurrentUser() user: AuthenticatedUser) {
    return this.aiJobAssistantService.usage(user);
  }

  @Post('draft/:draftId/publish')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  publishDraft(@CurrentUser() user: AuthenticatedUser, @Param('draftId', ParseUUIDPipe) draftId: string) {
    return this.aiJobAssistantService.publishDraft(user, draftId);
  }

  @Post('draft/:draftId/discard')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  discardDraft(@CurrentUser() user: AuthenticatedUser, @Param('draftId', ParseUUIDPipe) draftId: string) {
    return this.aiJobAssistantService.discardDraft(user, draftId);
  }
}
