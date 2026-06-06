import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadsModule } from '../uploads/uploads.module';
import { ContractorVerificationsAdminController } from './contractor-verifications.admin.controller';
import { ContractorVerificationsController } from './contractor-verifications.controller';
import { ContractorVerificationsService } from './contractor-verifications.service';

@Module({
  imports: [PrismaModule, UploadsModule, NotificationsModule, AuditLogsModule],
  controllers: [ContractorVerificationsController, ContractorVerificationsAdminController],
  providers: [ContractorVerificationsService],
})
export class ContractorVerificationsModule {}
