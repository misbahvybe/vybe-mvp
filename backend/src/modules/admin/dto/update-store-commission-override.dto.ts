import { Allow, IsNumber, Max, Min, ValidateIf } from 'class-validator';

/** Send `null` to clear the custom store rate and use the category default again. */
export class UpdateStoreCommissionOverrideDto {
  @Allow()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPercentOverride: number | null;
}
