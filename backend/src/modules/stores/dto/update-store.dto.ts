import { IsString, IsOptional, IsBoolean, Matches } from 'class-validator';

export class UpdateStoreDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'openingTime must be HH:mm' })
  openingTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'closingTime must be HH:mm' })
  closingTime?: string;

  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;
}
