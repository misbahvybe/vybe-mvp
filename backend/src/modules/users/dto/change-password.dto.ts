import { IsOptional, IsString, MinLength, Matches, ValidateIf } from 'class-validator';

export class ChangePasswordDto {
  /** Required when the account already has a password. */
  @IsOptional()
  @ValidateIf((o) => o.currentPassword != null && String(o.currentPassword).length > 0)
  @IsString()
  currentPassword?: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain uppercase, lowercase and number',
  })
  newPassword: string;

  @IsString()
  confirmNewPassword: string;
}
