import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { ContactUnlockStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class AdminContactsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn([ContactUnlockStatus.PENDING, ContactUnlockStatus.UNLOCKED])
  status?: ContactUnlockStatus;

  @IsOptional()
  @IsUUID()
  employerId?: string;

  @IsOptional()
  @IsUUID()
  contractorId?: string;

  @IsOptional()
  @IsUUID()
  jobRequestId?: string;
}
