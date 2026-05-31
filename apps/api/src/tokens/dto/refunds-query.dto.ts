import { IsIn, IsOptional } from 'class-validator';
import { RefundStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class RefundsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn([RefundStatus.PENDING, RefundStatus.APPROVED, RefundStatus.REJECTED])
  status?: RefundStatus;
}
