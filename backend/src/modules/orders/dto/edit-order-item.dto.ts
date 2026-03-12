import { IsNumber, IsOptional, IsBoolean } from 'class-validator';

export class EditOrderItemDto {
  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsBoolean()
  remove?: boolean;
}

