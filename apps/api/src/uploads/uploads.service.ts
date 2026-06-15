import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ReadObjectResult } from '../storage/storage.types';
import { StorageService } from '../modules/storage/storage.service';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);
const ALLOWED_DOCUMENT_MIME_TYPES = new Map([
  ...ALLOWED_MIME_TYPES,
  ['application/pdf', '.pdf'],
]);

type PublicMediaType = 'job-images' | 'avatars' | 'portfolio';

export type UploadedImageFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

export type StoredUpload = {
  url: string;
  fileName: string;
  key: string;
  size: number;
  mimeType: string;
};

@Injectable()
export class UploadsService {
  constructor(
    private readonly storageService: StorageService,
    private readonly config: ConfigService,
  ) {}

  async storeJobImages(files: UploadedImageFile[], ownerId: string, baseUrl: string) {
    if (!files.length) {
      throw new BadRequestException('Select at least one image to upload.');
    }

    if (files.length > 5) {
      throw new BadRequestException('You can upload up to 5 job images.');
    }

    return {
      images: await Promise.all(files.map((file) => this.storePublicImage(file, 'job-images', ownerId, this.baseUrl(baseUrl)))),
    };
  }

  readJobImage(ownerId: string, fileName: string) {
    return this.readPublicObject('job-images', ownerId, fileName);
  }

  readLegacyJobImage(fileName: string) {
    return this.readLegacyObject('job-images', fileName);
  }

  async storeAvatar(file: UploadedImageFile | undefined, userId: string, baseUrl: string) {
    if (!file) {
      throw new BadRequestException('Select an avatar image to upload.');
    }

    const stored = await this.storePublicImage(file, 'avatars', userId, this.baseUrl(baseUrl));

    return {
      avatarUrl: stored.url,
      fileName: stored.fileName,
      size: stored.size,
      mimeType: stored.mimeType,
    };
  }

  readAvatar(userId: string, fileName: string) {
    return this.readPublicObject('avatars', userId, fileName);
  }

  readLegacyAvatar(fileName: string) {
    return this.readLegacyObject('avatars', fileName);
  }

  async storePortfolioImages(files: UploadedImageFile[], contractorId: string, baseUrl: string) {
    if (!files.length) {
      throw new BadRequestException('Select at least one portfolio image to upload.');
    }

    if (files.length > 10) {
      throw new BadRequestException('You can upload up to 10 portfolio images.');
    }

    return {
      images: await Promise.all(
        files.map((file) => this.storePublicImage(file, 'portfolio', contractorId, this.baseUrl(baseUrl))),
      ),
    };
  }

  readPortfolioImage(contractorId: string, fileName: string) {
    return this.readPublicObject('portfolio', contractorId, fileName);
  }

  readLegacyPortfolioImage(fileName: string) {
    return this.readLegacyObject('portfolio', fileName);
  }

  async storeVerificationDocument(file: UploadedImageFile | undefined, contractorId: string, baseUrl: string) {
    if (!file) {
      throw new BadRequestException('Select a verification document to upload.');
    }

    this.assertValidDocument(file);

    const extension = ALLOWED_DOCUMENT_MIME_TYPES.get(file.mimetype) ?? this.extensionFromName(file.originalname);
    const fileName = `${randomUUID()}${extension}`;
    const key = this.keyFor('verification-documents', contractorId, fileName);
    const stored = await this.storageService.putObject({
      key,
      buffer: file.buffer,
      contentType: file.mimetype,
      isPrivate: true,
    });

    return {
      documentUrl: stored.key,
      fileName,
      key: stored.key,
      size: stored.size,
      mimeType: stored.contentType,
    };
  }

  readVerificationDocument(contractorId: string, fileName: string) {
    return this.readPrivateObject('verification-documents', contractorId, fileName);
  }

  readLegacyVerificationDocument(fileName: string) {
    return this.readLegacyObject('verification-documents', fileName);
  }

  private async storePublicImage(
    file: UploadedImageFile,
    type: PublicMediaType,
    ownerId: string,
    baseUrl: string,
  ): Promise<StoredUpload> {
    this.assertValidImage(file);

    const extension = ALLOWED_MIME_TYPES.get(file.mimetype) ?? this.extensionFromName(file.originalname);
    const fileName = `${randomUUID()}${extension}`;
    const key = this.keyFor(type, ownerId, fileName);
    const stored = await this.storageService.putObject({
      key,
      buffer: file.buffer,
      contentType: file.mimetype,
      isPrivate: false,
    });
    return {
      url: stored.key,
      fileName,
      key: stored.key,
      size: stored.size,
      mimeType: stored.contentType,
    };
  }

  private readPublicObject(type: PublicMediaType, ownerId: string, fileName: string) {
    const safeOwnerId = this.safeOwnerId(ownerId);
    const safeFileName = this.safeImageFileName(fileName);
    return this.storageService.readObject(this.keyFor(type, safeOwnerId, safeFileName));
  }

  private readPrivateObject(type: 'verification-documents', ownerId: string, fileName: string) {
    const safeOwnerId = this.safeOwnerId(ownerId);
    const safeFileName = this.safeDocumentFileName(fileName);
    return this.storageService.readObject(this.keyFor(type, safeOwnerId, safeFileName));
  }

  private readLegacyObject(type: PublicMediaType | 'verification-documents', fileName: string): Promise<ReadObjectResult> {
    const safeFileName = type === 'verification-documents' ? this.safeDocumentFileName(fileName) : this.safeImageFileName(fileName);
    const legacyFolder =
      type === 'job-images'
        ? 'job-images'
        : type === 'verification-documents'
          ? 'verification-documents'
          : type;
    const legacyKey = `${legacyFolder}/${safeFileName}`;
    return this.storageService.readObject(legacyKey);
  }

  private keyFor(type: PublicMediaType | 'verification-documents', ownerId: string, fileName: string) {
    const folder =
      type === 'job-images'
        ? 'jobs'
        : type === 'avatars'
          ? 'avatars'
          : type === 'portfolio'
            ? 'portfolio'
            : 'verification';
    return `${folder}/${ownerId}/${fileName}`;
  }

  private baseUrl(fallback: string) {
    return this.config.get<string>('APP_BASE_URL')?.trim().replace(/\/+$/, '') || fallback.replace(/\/+$/, '');
  }

  private assertValidImage(file: UploadedImageFile) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Only jpg, jpeg, png, and webp images are allowed.');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('Each image must be 5MB or smaller.');
    }
  }

  private extensionFromName(name: string) {
    const extension = extname(name).toLowerCase();
    return extension === '.jpeg' ? '.jpg' : extension;
  }

  private safeOwnerId(ownerId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(ownerId)) {
      throw new NotFoundException('File not found.');
    }

    return ownerId;
  }

  private safeImageFileName(fileName: string) {
    if (!/^[a-f0-9-]+\.(jpg|jpeg|png|webp)$/i.test(fileName)) {
      throw new NotFoundException('Image not found.');
    }

    return fileName;
  }

  private safeDocumentFileName(fileName: string) {
    if (!/^[a-f0-9-]+\.(jpg|jpeg|png|webp|pdf)$/i.test(fileName)) {
      throw new NotFoundException('Document not found.');
    }

    return fileName;
  }

  private assertValidDocument(file: UploadedImageFile) {
    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Only jpg, jpeg, png, webp, and pdf documents are allowed.');
    }

    if (file.size > MAX_DOCUMENT_SIZE) {
      throw new BadRequestException('Verification document must be 10MB or smaller.');
    }
  }
}
