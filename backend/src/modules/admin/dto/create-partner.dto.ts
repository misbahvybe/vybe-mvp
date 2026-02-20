import { IsString, IsEmail, IsOptional, IsBoolean, IsIn, MinLength } from 'class-validator';

export class CreatePartnerDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(10)
  phone: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsIn(['RIDER', 'STORE_OWNER'])
  role: 'RIDER' | 'STORE_OWNER';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
