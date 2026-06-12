import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { ReadObjectResult, StorageHealth, StorageProvider, StoreObjectInput, StoredObject } from './storage.types';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  readonly driver = 'local' as const;
  private readonly uploadRoot: string;

  constructor(config: ConfigService) {
    this.uploadRoot = resolve(config.get<string>('UPLOAD_DIR') ?? 'uploads');
    mkdirSync(this.uploadRoot, { recursive: true });
  }

  async putObject(input: StoreObjectInput): Promise<StoredObject> {
    const path = this.pathForKey(input.key);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, input.buffer);

    return {
      key: input.key,
      size: input.buffer.byteLength,
      contentType: input.contentType,
    };
  }

  async readObject(key: string): Promise<ReadObjectResult> {
    const path = this.pathForKey(key);

    if (!existsSync(path)) {
      throw new NotFoundException('File not found.');
    }

    return {
      stream: createReadStream(path),
      contentType: contentTypeFromKey(key),
    };
  }

  publicUrl() {
    return null;
  }

  async checkHealth(): Promise<StorageHealth> {
    try {
      mkdirSync(this.uploadRoot, { recursive: true });
      return { driver: this.driver, status: 'ok' };
    } catch (error) {
      return {
        driver: this.driver,
        status: 'degraded',
        detail: error instanceof Error ? error.message : 'Local upload directory is not writable.',
      };
    }
  }

  private pathForKey(key: string) {
    const safeKey = key.replace(/\\/g, '/').replace(/^\/+/, '');
    const resolvedPath = resolve(this.uploadRoot, safeKey);

    if (resolvedPath !== this.uploadRoot && !resolvedPath.startsWith(`${this.uploadRoot}${sep}`)) {
      throw new NotFoundException('File not found.');
    }

    return resolvedPath;
  }
}

export function contentTypeFromKey(key: string) {
  const lower = key.toLowerCase();

  if (lower.endsWith('.pdf')) {
    return 'application/pdf';
  }

  if (lower.endsWith('.png')) {
    return 'image/png';
  }

  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }

  return 'image/jpeg';
}
