import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class BrowseJobsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (value ? String(value).trim() : value))
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (value ? String(value).trim() : value))
  subcategory?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  @Transform(({ value }) => (value ? String(value).trim() : value))
  location?: string;

  @IsOptional()
  @IsIn(['newest', 'oldest'])
  sortBy: 'newest' | 'oldest' = 'newest';
}
