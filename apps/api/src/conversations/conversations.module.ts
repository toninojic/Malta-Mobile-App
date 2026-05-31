import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminConversationsController } from './conversations.admin.controller';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

@Module({
  imports: [PrismaModule],
  controllers: [ConversationsController, AdminConversationsController],
  providers: [ConversationsService],
})
export class ConversationsModule {}
