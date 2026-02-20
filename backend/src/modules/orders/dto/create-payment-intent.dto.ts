import { IsNumber, IsString, Min } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsNumber()
  @Min(1)
  amount: number; // Total in PKR (includes delivery)

  @IsString()
  paymentMethodId: string; // Our DB id of SavedPaymentMethod
}
