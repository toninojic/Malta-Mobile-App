import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, from, mergeMap } from 'rxjs';
import { StorageService } from './storage.service';

type RecordLike = Record<string, unknown>;

@Injectable()
export class StorageResponseInterceptor implements NestInterceptor {
  constructor(private readonly storageService: StorageService) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(mergeMap((value) => from(this.signStorageReferences(value))));
  }

  private async signStorageReferences(value: unknown): Promise<unknown> {
    if (Array.isArray(value)) {
      return Promise.all(value.map((item) => this.signStorageReferences(item)));
    }

    if (!value || typeof value !== 'object' || value instanceof Date) {
      return value;
    }

    const record = value as RecordLike;
    const nextRecord: RecordLike = {};
    for (const [key, childValue] of Object.entries(record)) {
      nextRecord[key] = await this.signStorageReferences(childValue);
    }

    await this.signField(nextRecord, 'url', 'key');
    await this.signField(nextRecord, 'avatarUrl', 'avatarKey');
    await this.signField(nextRecord, 'documentUrl', 'documentKey');

    return nextRecord;
  }

  private async signField(record: RecordLike, urlField: string, keyField: string) {
    const value = record[urlField];
    if (typeof value !== 'string') {
      return;
    }

    const storageKey = this.storageService.keyFromStorageReference(value);
    if (!storageKey) {
      return;
    }

    record[keyField] = storageKey;
    record[urlField] = await this.storageService.getSignedReadUrlForReference(storageKey);
  }
}
