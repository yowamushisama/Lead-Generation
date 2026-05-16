import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, ValidateNested } from 'class-validator';
import { ICPConfigDto } from './icp-config.dto';

export class CreateICPDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ValidateNested()
  @Type(() => ICPConfigDto)
  config!: ICPConfigDto;
}
