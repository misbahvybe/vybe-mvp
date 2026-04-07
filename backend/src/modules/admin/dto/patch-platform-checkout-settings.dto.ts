import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CheckoutServiceFeeMode } from '@prisma/client';

export class PatchPlatformCheckoutSettingsDto {
  @IsOptional()
  @IsEnum(CheckoutServiceFeeMode)
  serviceFeeMode?: CheckoutServiceFeeMode;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  serviceFeeFixed?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  serviceFeePercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  codTaxPercent?: number;
}
