import { IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class IngestReferenceDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  dryRun?: boolean;
}
