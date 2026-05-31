import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateRefundRequestDto {
  @IsUUID()
  tokenTransactionId!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1500)
  reason!: string;
}
