import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';

export class CreateTokenPackageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  tokenCount!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  price!: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency = 'EUR';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
