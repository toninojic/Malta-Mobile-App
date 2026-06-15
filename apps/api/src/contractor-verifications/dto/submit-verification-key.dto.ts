import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitVerificationKeyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  documentKey!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  documentMimeType!: string;
}
