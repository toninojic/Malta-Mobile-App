import { IsString, MaxLength, MinLength } from 'class-validator';

export class ReplyReviewDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1500)
  contractorReply!: string;
}
