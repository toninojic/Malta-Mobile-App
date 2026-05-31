import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminRefundDecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1500)
  adminNote?: string;
}
