import { IsIn, IsString } from 'class-validator';

export class UpdateStoreStatusDto {
  @IsString()
  @IsIn(['INVITED', 'ACTIVE', 'INACTIVE'])
  status: 'INVITED' | 'ACTIVE' | 'INACTIVE';
}

