import { IsString, IsBoolean, IsOptional, IsIn, MinLength, MaxLength, ValidateIf } from 'class-validator';

export class AddPaymentMethodDto {
  /** Stripe payment method ID (pm_xxx) - when using Stripe, last4/cardType come from Stripe */
  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @ValidateIf((o) => !o.paymentMethodId)
  @IsString()
  @MinLength(4)
  @MaxLength(4)
  last4?: string;

  @ValidateIf((o) => !o.paymentMethodId)
  @IsString()
  @IsIn(['Visa', 'Mastercard'])
  cardType?: 'Visa' | 'Mastercard';

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
