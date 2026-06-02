import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateJobDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Title is required.' })
  @IsNotEmpty({ message: 'Title is required.' })
  @MinLength(5, { message: 'Title must be at least 5 characters.' })
  @MaxLength(160)
  title!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Description is required.' })
  @IsNotEmpty({ message: 'Description is required.' })
  @MinLength(20, { message: 'Description must be at least 20 characters.' })
  @MaxLength(4000)
  description!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Category is required.' })
  @IsNotEmpty({ message: 'Category is required.' })
  @MaxLength(100)
  category!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Subcategory is required.' })
  @IsNotEmpty({ message: 'Subcategory is required.' })
  @MaxLength(100)
  subcategory!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Location is required.' })
  @IsNotEmpty({ message: 'Location is required.' })
  @MaxLength(160)
  location!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsUrl({}, { each: true })
  @MaxLength(2048, { each: true })
  imageUrls?: string[];
}
