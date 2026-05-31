import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateJobDto {
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(160)
  @Transform(({ value }) => (value ? String(value).trim() : value))
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  @Transform(({ value }) => (value ? String(value).trim() : value))
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => (value ? String(value).trim() : value))
  category?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => (value ? String(value).trim() : value))
  subcategory?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  @Transform(({ value }) => (value ? String(value).trim() : value))
  location?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsUrl({}, { each: true })
  @MaxLength(2048, { each: true })
  imageUrls?: string[];
}
