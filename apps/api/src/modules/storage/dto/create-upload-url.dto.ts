import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const STORAGE_FOLDERS = ['avatars', 'portfolio', 'jobs', 'verification'] as const;
export type StorageFolder = (typeof STORAGE_FOLDERS)[number];

export class CreateUploadUrlDto {
  @IsIn(STORAGE_FOLDERS)
  folder!: StorageFolder;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  fileName!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  contentType!: string;

  @IsOptional()
  @IsUUID()
  jobId?: string;
}
