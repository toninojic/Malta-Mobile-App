import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

const ANALYTICS_ENTITY_TYPES = [
  'JOB',
  'OFFER',
  'CONTACT',
  'CONVERSATION',
  'MESSAGE',
  'REVIEW',
  'REPORT',
  'PAYMENT',
  'TOKEN',
  'USER',
] as const;

export class CreateAnalyticsEventDto {
  @IsString()
  @MaxLength(120)
  sessionId!: string;

  @IsString()
  @MaxLength(120)
  eventName!: string;

  @IsString()
  @MaxLength(120)
  screen!: string;

  @IsOptional()
  @IsIn(ANALYTICS_ENTITY_TYPES)
  entityType?: (typeof ANALYTICS_ENTITY_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  entityId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsString()
  @MaxLength(40)
  platform!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;
}

export class CreateAnalyticsEventsBatchDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateAnalyticsEventDto)
  events!: CreateAnalyticsEventDto[];
}
