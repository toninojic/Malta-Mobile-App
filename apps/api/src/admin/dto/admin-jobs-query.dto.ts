import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { JobStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class AdminJobsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn([JobStatus.ACTIVE, JobStatus.IN_PROGRESS, JobStatus.EXPIRED, JobStatus.COMPLETED, JobStatus.CLOSED])
  status?: JobStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (value ? String(value).trim() : value))
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  @Transform(({ value }) => (value ? String(value).trim() : value))
  location?: string;

  @IsOptional()
  @IsUUID()
  employerId?: string;
}
