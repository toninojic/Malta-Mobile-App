import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateOfferDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  estimatedPrice!: number;

  @IsDateString()
  startDate!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  estimatedCompletionDays!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  message?: string;
}
