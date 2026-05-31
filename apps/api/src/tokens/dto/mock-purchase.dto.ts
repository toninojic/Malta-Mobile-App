import { IsUUID } from 'class-validator';

export class MockPurchaseDto {
  @IsUUID()
  tokenPackageId!: string;
}
