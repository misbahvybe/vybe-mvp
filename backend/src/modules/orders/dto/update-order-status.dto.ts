import { IsString, IsIn, IsOptional } from 'class-validator';

const VALID_STATUSES = [
  'STORE_ACCEPTED',
  'STORE_REJECTED',
  'READY_FOR_PICKUP',
  'RIDER_ASSIGNED',
  'RIDER_ACCEPTED',
  'PICKED_UP',
  'DELIVERED',
  'CANCELLED',
] as const;

const CANCELLATION_REASONS = [
  'CUSTOMER_CANCELLED',
  'STORE_REJECTED',
  'ADMIN_CANCELLED',
  'OUT_OF_STOCK',
  'STORE_CLOSED',
  'OTHER',
] as const;

export class UpdateOrderStatusDto {
  @IsString()
  @IsIn(VALID_STATUSES)
  status: (typeof VALID_STATUSES)[number];

  @IsOptional()
  @IsString()
  riderId?: string;

  @IsOptional()
  @IsString()
  @IsIn(CANCELLATION_REASONS)
  cancellationReason?: (typeof CANCELLATION_REASONS)[number];
}
