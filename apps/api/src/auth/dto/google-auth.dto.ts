import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

export class GoogleAuthDto {
  @IsString()
  @MinLength(20)
  idToken!: string;

  @IsOptional()
  @IsIn([UserRole.EMPLOYER, UserRole.CONTRACTOR])
  role?: 'EMPLOYER' | 'CONTRACTOR';

  @IsOptional()
  @IsBoolean()
  termsAccepted?: boolean;

  @IsOptional()
  @IsBoolean()
  privacyAccepted?: boolean;
}
