import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ContractorServiceCategoryDto {
  @IsString()
  @MaxLength(100)
  categoryKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  subcategoryKey?: string;
}

export class UpdateServiceCategoriesDto {
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => ContractorServiceCategoryDto)
  categories!: ContractorServiceCategoryDto[];
}
