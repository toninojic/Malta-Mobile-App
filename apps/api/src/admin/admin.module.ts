import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TokensModule } from '../tokens/tokens.module';
import { AdminJobsController } from './admin-jobs.controller';
import { AdminOffersController } from './admin-offers.controller';
import { AdminStatisticsController } from './admin-statistics.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [PrismaModule, NotificationsModule, AuditLogsModule, TokensModule],
  controllers: [AdminStatisticsController, AdminUsersController, AdminJobsController, AdminOffersController],
  providers: [AdminService],
})
export class AdminModule {}
