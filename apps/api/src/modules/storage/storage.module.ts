import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageController } from './storage.controller';
import { StorageResponseInterceptor } from './storage-response.interceptor';
import { StorageService } from './storage.service';

@Module({
  imports: [PrismaModule],
  controllers: [StorageController],
  providers: [StorageService, StorageResponseInterceptor],
  exports: [StorageService, StorageResponseInterceptor],
})
export class StorageModule {}
