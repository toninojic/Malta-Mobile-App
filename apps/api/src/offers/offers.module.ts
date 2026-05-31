import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [OffersController],
  providers: [OffersService],
})
export class OffersModule {}
