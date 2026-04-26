import { IsEmail, IsString, MinLength, IsOptional, ValidateIf } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  name: string;

  /** If omitted, the email is left unchanged. Send null or "" to clear. */
  @IsOptional()
  @ValidateIf((o) => o.email != null && String(o.email).trim() !== '')
  @IsEmail({}, { message: 'Invalid email address' })
  email?: string | null;
}
