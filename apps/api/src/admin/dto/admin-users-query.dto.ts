import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { UserRole, UserStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class AdminUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn([UserRole.EMPLOYER, UserRole.CONTRACTOR, UserRole.ADMIN])
  role?: UserRole;

  @IsOptional()
  @IsIn([UserStatus.ACTIVE, UserStatus.SUSPENDED])
  status?: UserStatus;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  @Transform(({ value }) => (value ? String(value).trim() : value))
  search?: string;
}
