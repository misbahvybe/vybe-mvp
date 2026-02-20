import { IsString, Matches } from 'class-validator';

export class LoginOtpDto {
  @IsString()
  @Matches(/^(\+92|0)?3[0-9]{9}$/)
  phone: string;
}
