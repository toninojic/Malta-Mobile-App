import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import { contentTypeFromKey } from './local-storage.provider';
import { ReadObjectResult, StorageHealth, StorageProvider, StoreObjectInput, StoredObject } from './storage.types';

type SignedRequest = {
  url: string;
  headers: Record<string, string>;
};

@Injectable()
export class S3StorageProvider implements StorageProvider {
  readonly driver = 's3' as const;

  private readonly region: string;
  private readonly bucket: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly publicBaseUrl: string;
  private readonly endpoint?: string;

  constructor(config: ConfigService) {
    this.region = config.get<string>('AWS_REGION')?.trim() ?? '';
    this.bucket = config.get<string>('AWS_S3_BUCKET')?.trim() ?? '';
    this.accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID')?.trim() ?? '';
    this.secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY')?.trim() ?? '';
    this.publicBaseUrl = config.get<string>('AWS_S3_PUBLIC_BASE_URL')?.trim().replace(/\/+$/, '') ?? '';
    this.endpoint = config.get<string>('AWS_S3_ENDPOINT')?.trim().replace(/\/+$/, '');
  }

  async putObject(input: StoreObjectInput): Promise<StoredObject> {
    this.assertConfigured();

    const signed = this.signRequest({
      method: 'PUT',
      key: input.key,
      body: input.buffer,
      contentType: input.contentType,
    });
    const response = await fetch(signed.url, {
      method: 'PUT',
      headers: signed.headers,
      body: input.buffer as unknown as BodyInit,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new ServiceUnavailableException(`S3 upload failed with ${response.status}.${detail ? ` ${detail}` : ''}`);
    }

    return {
      key: input.key,
      size: input.buffer.byteLength,
      contentType: input.contentType,
    };
  }

  async readObject(key: string): Promise<ReadObjectResult> {
    this.assertConfigured();

    const signed = this.signRequest({
      method: 'GET',
      key,
    });
    const response = await fetch(signed.url, {
      method: 'GET',
      headers: signed.headers,
    });

    if (!response.ok || !response.body) {
      throw new ServiceUnavailableException(`S3 read failed with ${response.status}.`);
    }

    const arrayBuffer = await response.arrayBuffer();

    return {
      stream: Readable.from(Buffer.from(arrayBuffer)),
      contentType: response.headers.get('content-type') ?? contentTypeFromKey(key),
    };
  }

  publicUrl(key: string) {
    this.assertConfigured();
    return `${this.publicBaseUrl}/${encodeURI(key).replace(/%2F/g, '/')}`;
  }

  async checkHealth(): Promise<StorageHealth> {
    try {
      this.assertConfigured();
      return { driver: this.driver, status: 'ok' };
    } catch (error) {
      return {
        driver: this.driver,
        status: 'degraded',
        detail: error instanceof Error ? error.message : 'S3 storage is not configured.',
      };
    }
  }

  private assertConfigured() {
    const missing = [
      ['AWS_REGION', this.region],
      ['AWS_S3_BUCKET', this.bucket],
      ['AWS_ACCESS_KEY_ID', this.accessKeyId],
      ['AWS_SECRET_ACCESS_KEY', this.secretAccessKey],
      ['AWS_S3_PUBLIC_BASE_URL', this.publicBaseUrl],
    ].filter(([, value]) => !value);

    if (missing.length) {
      throw new ServiceUnavailableException(`S3 storage is not configured: ${missing.map(([key]) => key).join(', ')}`);
    }
  }

  private signRequest(input: { method: 'GET' | 'PUT'; key: string; body?: Buffer; contentType?: string }): SignedRequest {
    const now = new Date();
    const amzDate = toAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256Hex(input.body ?? Buffer.from(''));
    const encodedKey = input.key
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');
    const baseUrl = this.endpoint
      ? `${this.endpoint}/${this.bucket}/${encodedKey}`
      : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${encodedKey}`;
    const url = new URL(baseUrl);
    const host = url.host;
    const headers: Record<string, string> = {
      host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    };

    if (input.contentType) {
      headers['content-type'] = input.contentType;
    }

    const sortedHeaderKeys = Object.keys(headers).sort();
    const canonicalHeaders = sortedHeaderKeys.map((key) => `${key}:${headers[key]}\n`).join('');
    const signedHeaders = sortedHeaderKeys.join(';');
    const canonicalRequest = [
      input.method,
      url.pathname,
      url.searchParams.toString(),
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256Hex(Buffer.from(canonicalRequest)),
    ].join('\n');
    const signingKey = getSignatureKey(this.secretAccessKey, dateStamp, this.region, 's3');
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    headers.authorization =
      `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    if (input.method === 'PUT' && input.contentType) {
      headers['content-length'] = String(input.body?.byteLength ?? 0);
    }

    return {
      url: url.toString(),
      headers,
    };
  }
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function sha256Hex(input: Buffer) {
  return createHash('sha256').update(input).digest('hex');
}

function hmac(key: Buffer | string, value: string) {
  return createHmac('sha256', key).update(value).digest();
}

function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string) {
  const kDate = hmac(`AWS4${key}`, dateStamp);
  const kRegion = hmac(kDate, regionName);
  const kService = hmac(kRegion, serviceName);
  return hmac(kService, 'aws4_request');
}

export function parseStorageDriver(value: string | undefined) {
  const normalized = String(value ?? 'local').trim().toLowerCase();

  if (normalized !== 'local' && normalized !== 's3') {
    throw new BadRequestException('STORAGE_DRIVER must be local or s3.');
  }

  return normalized;
}
