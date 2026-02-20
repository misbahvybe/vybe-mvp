import { IsString, IsNotEmpty } from 'class-validator';

export class ValidateInviteDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
