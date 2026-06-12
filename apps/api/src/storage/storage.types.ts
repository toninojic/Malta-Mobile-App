import { Readable } from 'node:stream';

export type StorageDriver = 'local' | 's3';

export type StoreObjectInput = {
  key: string;
  buffer: Buffer;
  contentType: string;
  isPrivate?: boolean;
};

export type StoredObject = {
  key: string;
  size: number;
  contentType: string;
};

export type ReadObjectResult = {
  stream: Readable;
  contentType: string;
};

export type StorageHealth = {
  driver: StorageDriver;
  status: 'ok' | 'degraded';
  detail?: string;
};

export interface StorageProvider {
  readonly driver: StorageDriver;
  putObject(input: StoreObjectInput): Promise<StoredObject>;
  readObject(key: string): Promise<ReadObjectResult>;
  publicUrl(key: string): string | null;
  checkHealth(): Promise<StorageHealth>;
}
