import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminPushTokensController, PushTokensController } from './push-tokens.controller';
import { PushNotificationService } from './push-notification.service';

@Module({
  imports: [PrismaModule],
  controllers: [PushTokensController, AdminPushTokensController],
  providers: [PushNotificationService],
  exports: [PushNotificationService],
})
export class PushModule {}
