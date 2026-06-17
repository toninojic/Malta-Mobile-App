import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';

export class UpdateServiceAreasDto {
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  locations!: string[];
}
