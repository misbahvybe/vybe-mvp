import { IsString, Matches } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @Matches(/^(\+92|0)?3[0-9]{9}$/, { message: 'Invalid WhatsApp/phone number' })
  phone: string;
}
