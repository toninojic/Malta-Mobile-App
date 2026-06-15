import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateJobDto {
  @IsOptional()
  @IsString({ message: 'Title is required.' })
  @IsNotEmpty({ message: 'Title is required.' })
  @MinLength(5, { message: 'Title must be at least 5 characters.' })
  @MaxLength(160)
  @Transform(({ value }) => (value ? String(value).trim() : value))
  title?: string;

  @IsOptional()
  @IsString({ message: 'Description is required.' })
  @IsNotEmpty({ message: 'Description is required.' })
  @MinLength(20, { message: 'Description must be at least 20 characters.' })
  @MaxLength(4000)
  @Transform(({ value }) => (value ? String(value).trim() : value))
  description?: string;

  @IsOptional()
  @IsString({ message: 'Category is required.' })
  @IsNotEmpty({ message: 'Category is required.' })
  @MaxLength(100)
  @Transform(({ value }) => (value ? String(value).trim() : value))
  category?: string;

  @IsOptional()
  @IsString({ message: 'Subcategory is required.' })
  @IsNotEmpty({ message: 'Subcategory is required.' })
  @MaxLength(100)
  @Transform(({ value }) => (value ? String(value).trim() : value))
  subcategory?: string;

  @IsOptional()
  @IsString({ message: 'Location is required.' })
  @IsNotEmpty({ message: 'Location is required.' })
  @MaxLength(160)
  @Transform(({ value }) => (value ? String(value).trim() : value))
  location?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(512, { each: true })
  imageKeys?: string[];
}
