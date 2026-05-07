import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class UpdateStoreMinimumOrderDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minimumOrderValue!: number;
}
