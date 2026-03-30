import { Allow, IsNumber, Max, Min, ValidateIf } from 'class-validator';

/** Send `null` to clear override and use platform category rules. */
export class UpdateStoreCommissionOverrideDto {
  @Allow()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPercentOverride: number | null;
}
