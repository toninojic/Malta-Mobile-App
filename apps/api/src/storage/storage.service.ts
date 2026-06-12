import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalStorageProvider } from './local-storage.provider';
import { parseStorageDriver, S3StorageProvider } from './s3-storage.provider';
import { ReadObjectResult, StorageDriver, StorageHealth, StoreObjectInput, StoredObject, StorageProvider } from './storage.types';

@Injectable()
export class StorageService {
  private readonly provider: StorageProvider;

  constructor(
    config: ConfigService,
    localStorageProvider: LocalStorageProvider,
    s3StorageProvider: S3StorageProvider,
  ) {
    const driver = parseStorageDriver(config.get<string>('STORAGE_DRIVER'));
    this.provider = driver === 's3' ? s3StorageProvider : localStorageProvider;
  }

  get driver(): StorageDriver {
    return this.provider.driver;
  }

  putObject(input: StoreObjectInput): Promise<StoredObject> {
    return this.provider.putObject(input);
  }

  readObject(key: string): Promise<ReadObjectResult> {
    return this.provider.readObject(key);
  }

  publicUrl(key: string) {
    return this.provider.publicUrl(key);
  }

  checkHealth(): Promise<StorageHealth> {
    return this.provider.checkHealth();
  }
}
