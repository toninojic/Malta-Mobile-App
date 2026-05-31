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

export class CreateJobDto {
  @IsString()
  @MinLength(4)
  @MaxLength(160)
  @Transform(({ value }) => String(value).trim())
  title!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  @Transform(({ value }) => String(value).trim())
  description!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => String(value).trim())
  category!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => String(value).trim())
  subcategory!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  @Transform(({ value }) => String(value).trim())
  location!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsUrl({}, { each: true })
  @MaxLength(2048, { each: true })
  imageUrls?: string[];
}
