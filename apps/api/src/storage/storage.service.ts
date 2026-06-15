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
    const shouldUseS3 = driver === 's3' && (isProduction(config) || hasCompleteS3Config(config));
    this.provider = shouldUseS3 ? s3StorageProvider : localStorageProvider;
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

function isProduction(config: ConfigService) {
  return config.get<string>('NODE_ENV') === 'production';
}

function hasCompleteS3Config(config: ConfigService) {
  return ['AWS_REGION', 'AWS_S3_BUCKET', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_S3_PUBLIC_BASE_URL'].every(
    (key) => Boolean(config.get<string>(key)?.trim()),
  );
}
