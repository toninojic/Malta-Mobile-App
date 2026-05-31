import { IsIn, IsOptional } from 'class-validator';
import { OfferStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class OffersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn([OfferStatus.PENDING, OfferStatus.SELECTED, OfferStatus.REJECTED, OfferStatus.WITHDRAWN])
  status?: OfferStatus;
}
