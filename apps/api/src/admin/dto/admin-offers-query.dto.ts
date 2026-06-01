import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { OfferStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class AdminOffersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn([OfferStatus.PENDING, OfferStatus.SELECTED, OfferStatus.REJECTED, OfferStatus.WITHDRAWN, OfferStatus.COMPLETED])
  status?: OfferStatus;

  @IsOptional()
  @IsUUID()
  jobRequestId?: string;

  @IsOptional()
  @IsUUID()
  contractorId?: string;
}
