import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectVerificationDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;
}
