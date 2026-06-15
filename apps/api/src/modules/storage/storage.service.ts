import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { Readable } from 'node:stream';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUploadUrlDto, StorageFolder } from './dto/create-upload-url.dto';

const IMAGE_CONTENT_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);
const DOCUMENT_CONTENT_TYPES = new Map([...IMAGE_CONTENT_TYPES, ['application/pdf', '.pdf']]);
const PUBLIC_IMAGE_EXPIRATION_SECONDS = 24 * 60 * 60;
const VERIFICATION_EXPIRATION_SECONDS = 10 * 60;
const UPLOAD_EXPIRATION_SECONDS = 10 * 60;

type ParsedStorageKey =
  | { folder: 'avatars'; ownerId: string }
  | { folder: 'portfolio'; ownerId: string }
  | { folder: 'jobs'; jobId: string }
  | { folder: 'verification'; ownerId: string };

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly publicBaseUrl?: string;
  private readonly storageDriver: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.region = this.config.get<string>('AWS_REGION')?.trim() ?? '';
    this.bucket = this.config.get<string>('AWS_S3_BUCKET')?.trim() ?? '';
    this.publicBaseUrl = this.config.get<string>('AWS_S3_PUBLIC_BASE_URL')?.trim().replace(/\/+$/, '') || undefined;
    this.storageDriver = this.config.get<string>('STORAGE_DRIVER')?.trim().toLowerCase() ?? 'local';

    this.client = new S3Client({
      region: this.region || 'eu-central-1',
      credentials: this.hasCredentials()
        ? {
            accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID')?.trim() ?? '',
            secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY')?.trim() ?? '',
          }
        : undefined,
    });
  }

  onModuleInit() {
    if (this.storageDriver === 's3') {
      this.assertConfigured();
    }
  }

  get driver() {
    return this.storageDriver === 's3' ? 's3' : 'local';
  }

  async createUploadUrl(user: AuthenticatedUser, dto: CreateUploadUrlDto) {
    this.assertConfigured();
    this.assertContentType(dto.folder, dto.contentType);

    const key = await this.keyForUpload(user, dto);
    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: dto.contentType,
      }),
      { expiresIn: UPLOAD_EXPIRATION_SECONDS },
    );

    this.logger.log(`Generated S3 upload URL for ${dto.folder}: ${key}`);
    return { key, uploadUrl };
  }

  async createViewUrl(user: AuthenticatedUser, key: string) {
    const normalizedKey = this.normalizeKey(key);
    await this.assertCanViewKey(user, normalizedKey);
    const url = await this.getSignedReadUrl(normalizedKey);
    this.logger.log(`Generated S3 read URL for ${normalizedKey}`);
    return { url };
  }

  async deleteObject(user: AuthenticatedUser, key: string) {
    this.assertConfigured();
    const normalizedKey = this.normalizeKey(key);
    await this.assertCanDeleteKey(user, normalizedKey);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: normalizedKey }));
    this.logger.log(`Deleted S3 object ${normalizedKey}`);
    return { success: true };
  }

  async putObject(input: { key: string; buffer: Buffer; contentType: string; isPrivate?: boolean }) {
    this.assertConfigured();
    const key = this.normalizeKey(input.key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: input.buffer,
        ContentType: input.contentType,
      }),
    );
    this.logger.log(`Uploaded S3 object through API compatibility path: ${key}`);
    return {
      key,
      size: input.buffer.byteLength,
      contentType: input.contentType,
    };
  }

  async readObject(key: string) {
    this.assertConfigured();
    const normalizedKey = this.normalizeKey(key);
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: normalizedKey }));
    if (!response.Body) {
      throw new NotFoundException('File not found.');
    }
    return {
      stream: await bodyToReadable(response.Body),
      contentType: response.ContentType ?? contentTypeFromKey(normalizedKey),
    };
  }

  async getSignedReadUrlForReference(value: string | null | undefined) {
    if (!value) {
      return null;
    }

    const key = this.keyFromStorageReference(value);
    if (!key) {
      return value;
    }

    return this.getSignedReadUrl(key);
  }

  keyFromStorageReference(value: string | null | undefined) {
    if (!value) {
      return null;
    }

    const trimmed = value.trim();
    if (isStorageKey(trimmed)) {
      return trimmed;
    }

    if (trimmed.includes('X-Amz-Signature')) {
      return null;
    }

    if (this.publicBaseUrl) {
      const encodedBase = `${this.publicBaseUrl}/`;
      if (trimmed.startsWith(encodedBase)) {
        return this.safeDecodeKey(trimmed.slice(encodedBase.length).split('?')[0] ?? '');
      }
    }

    try {
      const url = new URL(trimmed);
      const expectedHost = `${this.bucket}.s3.${this.region}.amazonaws.com`;
      if (url.host === expectedHost) {
        return this.safeDecodeKey(url.pathname.replace(/^\/+/, ''));
      }
    } catch {
      return null;
    }

    return null;
  }

  async checkHealth() {
    if (this.storageDriver !== 's3') {
      return { driver: 'local' as const, status: 'ok' as const };
    }

    try {
      this.assertConfigured();
      return { driver: 's3' as const, status: 'ok' as const };
    } catch (error) {
      return {
        driver: 's3' as const,
        status: 'degraded' as const,
        detail: error instanceof Error ? error.message : 'S3 storage is not configured.',
      };
    }
  }

  private async getSignedReadUrl(key: string) {
    this.assertConfigured();
    const expiresIn = key.startsWith('verification/') ? VERIFICATION_EXPIRATION_SECONDS : PUBLIC_IMAGE_EXPIRATION_SECONDS;
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn });
  }

  private async keyForUpload(user: AuthenticatedUser, dto: CreateUploadUrlDto) {
    const fileName = this.safeFileName(dto.fileName, dto.contentType);
    const uniqueFileName = `${Date.now()}-${randomUUID()}-${fileName}`;

    if (dto.folder === 'avatars') {
      return `avatars/${user.id}/${uniqueFileName}`;
    }

    if (dto.folder === 'portfolio') {
      if (user.role !== UserRole.CONTRACTOR) {
        throw new ForbiddenException('Only contractors can upload portfolio images.');
      }
      return `portfolio/${user.id}/${uniqueFileName}`;
    }

    if (dto.folder === 'verification') {
      if (user.role !== UserRole.CONTRACTOR) {
        throw new ForbiddenException('Only contractors can upload verification documents.');
      }
      return `verification/${user.id}/${uniqueFileName}`;
    }

    if (!dto.jobId) {
      throw new BadRequestException('jobId is required when uploading job images.');
    }

    const job = await this.prisma.jobRequest.findUnique({ where: { id: dto.jobId }, select: { employerId: true } });
    if (!job) {
      throw new NotFoundException('Job request not found.');
    }
    if (user.role !== UserRole.ADMIN && job.employerId !== user.id) {
      throw new ForbiddenException('You can upload images only for your own job requests.');
    }

    return `jobs/${dto.jobId}/${uniqueFileName}`;
  }

  private async assertCanViewKey(user: AuthenticatedUser, key: string) {
    const parsed = this.parseKey(key);

    if (parsed.folder === 'verification') {
      if (user.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Only admins can view verification documents.');
      }
      return;
    }

    if (parsed.folder === 'jobs') {
      const job = await this.prisma.jobRequest.findUnique({ where: { id: parsed.jobId }, select: { id: true } });
      if (!job) {
        throw new NotFoundException('Job image not found.');
      }
    }
  }

  private async assertCanDeleteKey(user: AuthenticatedUser, key: string) {
    const parsed = this.parseKey(key);

    if (user.role === UserRole.ADMIN) {
      return;
    }

    if ((parsed.folder === 'avatars' || parsed.folder === 'portfolio' || parsed.folder === 'verification') && parsed.ownerId === user.id) {
      return;
    }

    if (parsed.folder === 'jobs') {
      const job = await this.prisma.jobRequest.findUnique({
        where: { id: parsed.jobId },
        select: { employerId: true },
      });
      if (job?.employerId === user.id) {
        return;
      }
    }

    throw new ForbiddenException('You cannot delete this file.');
  }

  private parseKey(key: string): ParsedStorageKey {
    const normalized = this.normalizeKey(key);
    const parts = normalized.split('/');
    const [folder, ownerOrJobId] = parts;

    if (!ownerOrJobId || parts.length < 3) {
      throw new BadRequestException('Invalid storage key.');
    }

    if (folder === 'avatars' || folder === 'portfolio' || folder === 'verification') {
      return { folder, ownerId: ownerOrJobId };
    }

    if (folder === 'jobs') {
      return { folder, jobId: ownerOrJobId };
    }

    throw new BadRequestException('Invalid storage folder.');
  }

  private normalizeKey(key: string) {
    const normalized = key.trim().replace(/^\/+/, '');
    if (!isStorageKey(normalized) || normalized.includes('..') || normalized.includes('\\')) {
      throw new BadRequestException('Invalid storage key.');
    }
    return normalized;
  }

  private safeFileName(fileName: string, contentType: string) {
    const baseName = fileName
      .trim()
      .replace(/\\/g, '/')
      .split('/')
      .pop()
      ?.replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 120);
    if (!baseName) {
      throw new BadRequestException('File name is required.');
    }

    const requiredExtension = DOCUMENT_CONTENT_TYPES.get(contentType);
    const currentExtension = extname(baseName).toLowerCase();
    return currentExtension === requiredExtension ? baseName : `${baseName.replace(/\.[^.]+$/, '')}${requiredExtension}`;
  }

  private assertContentType(folder: StorageFolder, contentType: string) {
    const allowed = folder === 'verification' ? DOCUMENT_CONTENT_TYPES : IMAGE_CONTENT_TYPES;
    if (!allowed.has(contentType)) {
      throw new BadRequestException(
        folder === 'verification'
          ? 'Only jpg, jpeg, png, webp, and pdf documents are allowed.'
          : 'Only jpg, jpeg, png, and webp images are allowed.',
      );
    }
  }

  private assertConfigured() {
    const missing = ['AWS_REGION', 'AWS_S3_BUCKET', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'].filter(
      (key) => !this.config.get<string>(key)?.trim(),
    );

    if (missing.length) {
      throw new ServiceUnavailableException(`S3 storage is not configured: ${missing.join(', ')}`);
    }
  }

  private hasCredentials() {
    return Boolean(this.config.get<string>('AWS_ACCESS_KEY_ID')?.trim() && this.config.get<string>('AWS_SECRET_ACCESS_KEY')?.trim());
  }

  private safeDecodeKey(value: string) {
    try {
      const decoded = decodeURI(value);
      return isStorageKey(decoded) ? decoded : null;
    } catch {
      return null;
    }
  }
}

export function isStorageKey(value: string) {
  return /^(avatars|portfolio|jobs|verification)\/[0-9a-f-]{36}\/[^/]+$/i.test(value);
}

async function bodyToReadable(body: unknown): Promise<Readable> {
  if (body instanceof Readable) {
    return body;
  }

  if (body && typeof body === 'object' && 'transformToByteArray' in body) {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return Readable.from(Buffer.from(bytes));
  }

  throw new ServiceUnavailableException('S3 object body is not readable.');
}

function contentTypeFromKey(key: string) {
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
