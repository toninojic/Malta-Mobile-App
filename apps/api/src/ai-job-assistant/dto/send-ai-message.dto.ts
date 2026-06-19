import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendAiMessageDto {
  @IsUUID('4', { message: 'Conversation id is required.' })
  conversationId!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Message is required.' })
  @IsNotEmpty({ message: 'Message is required.' })
  @MaxLength(500, { message: 'Message must be 500 characters or fewer.' })
  message!: string;
}
