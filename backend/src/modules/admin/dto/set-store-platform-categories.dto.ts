import { IsArray, IsString } from 'class-validator';

/** Slugs matching customer app: food, grocery, medicine (lowercase). */
export class SetStorePlatformCategoriesDto {
  @IsArray()
  @IsString({ each: true })
  names: string[];
}
