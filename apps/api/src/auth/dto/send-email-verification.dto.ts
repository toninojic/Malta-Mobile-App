import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SendEmailVerificationDto {
  @IsOptional()
  @IsString()
  @MaxLength(320)
  email?: string;
}
