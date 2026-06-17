import { Module } from '@nestjs/common';
import { PushModule } from '../push/push.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminNotificationsController } from './notifications.admin.controller';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [PrismaModule, PushModule],
  controllers: [NotificationsController, AdminNotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
