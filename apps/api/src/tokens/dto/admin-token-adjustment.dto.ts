import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AdminGrantTokensDto {
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null || value === '' ? 10 : Number(value)))
  @IsInt({ message: 'Amount must be a whole number.' })
  @Min(1, { message: 'Amount must be at least 1.' })
  @Max(1000, { message: 'Amount must be 1000 or less.' })
  amount = 10;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Reason is required.' })
  @IsNotEmpty({ message: 'Reason is required.' })
  @MaxLength(500, { message: 'Reason must be 500 characters or fewer.' })
  reason!: string;
}

export class AdminRevokeTokensDto {
  @Transform(({ value }) => Number(value))
  @IsInt({ message: 'Amount must be a whole number.' })
  @Min(1, { message: 'Amount must be at least 1.' })
  @Max(1000, { message: 'Amount must be 1000 or less.' })
  amount!: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Reason is required.' })
  @IsNotEmpty({ message: 'Reason is required.' })
  @MaxLength(500, { message: 'Reason must be 500 characters or fewer.' })
  reason!: string;
}
