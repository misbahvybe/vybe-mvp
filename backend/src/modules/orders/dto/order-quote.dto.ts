import { IsString, IsArray, IsNumber, IsOptional, ValidateNested, ArrayMinSize, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

class QuoteOrderItemDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsNumber()
  price?: number;
}

export class OrderQuoteDto {
  @IsString()
  storeId: string;

  @IsString()
  addressId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => QuoteOrderItemDto)
  items: QuoteOrderItemDto[];

  @IsOptional()
  @IsString()
  @IsIn(['COD', 'CARD'])
  paymentMethod?: 'COD' | 'CARD';
}
