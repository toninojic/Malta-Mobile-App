import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @MaxLength(255)
  @Matches(/^(Expo(nent)?PushToken\[[^\]]+\]|[A-Za-z0-9_-]{20,})$/, {
    message: 'Expo push token is invalid.',
  })
  expoPushToken!: string;

  @IsIn(['ios', 'android'])
  platform!: 'ios' | 'android';

  @IsOptional()
  @IsString()
  @MaxLength(180)
  deviceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  deviceName?: string;
}
