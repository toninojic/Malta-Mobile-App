import { Module } from '@nestjs/common';
import { LocalStorageProvider } from './local-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';
import { StorageService } from './storage.service';

@Module({
  providers: [LocalStorageProvider, S3StorageProvider, StorageService],
  exports: [StorageService],
})
export class StorageModule {}
