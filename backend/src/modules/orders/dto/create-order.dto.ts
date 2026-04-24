import { IsString, IsArray, IsNumber, IsOptional, ValidateNested, ArrayMinSize, IsIn, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

class OrderItemDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  price: number;
}

export class CreateOrderDto {
  @IsString()
  storeId: string;

  @IsString()
  addressId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @IsIn(['COD', 'CARD', 'MANUAL_TRANSFER'])
  paymentMethod?: 'COD' | 'CARD' | 'MANUAL_TRANSFER';

  @ValidateIf((o: CreateOrderDto) => o.paymentMethod === 'MANUAL_TRANSFER')
  @IsString()
  @IsIn(['JAZZCASH', 'EASYPAISA', 'BANK_MANUAL'])
  manualTransferProvider?: 'JAZZCASH' | 'EASYPAISA' | 'BANK_MANUAL';

  @IsOptional()
  @IsString()
  paymentMethodId?: string; // our DB id – used when paymentIntentId not provided (simulated flow)

  @IsOptional()
  @IsString()
  paymentIntentId?: string; // Stripe PI id – when provided, payment already confirmed

  @IsOptional()
  @IsString()
  xpayIntentId?: string; // XPay intent id – when provided, payment already confirmed
}
