import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

/** Percent added on top of store catalogue price for customers (e.g. 10 → +10%). */
export class UpdateStoreCustomerMarkupDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(500)
  customerPriceMarkupPercent!: number;
}
