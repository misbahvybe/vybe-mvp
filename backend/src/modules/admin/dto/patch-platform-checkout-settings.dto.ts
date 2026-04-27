import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
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

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  codTaxEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  deliveryBasePerKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(5)
  weekendMultiplier?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(5)
  peakMultiplier?: number;

  @IsOptional()
  @IsString()
  peakStartTime?: string; // HH:mm

  @IsOptional()
  @IsString()
  peakEndTime?: string; // HH:mm

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  /** Platform-wide: skip store Accept tap (all stores). OR’d with `VYBE_POS_AUTO_ACCEPT_ORDERS` if that env is set. */
  posAutoAcceptOrders?: boolean;
}
