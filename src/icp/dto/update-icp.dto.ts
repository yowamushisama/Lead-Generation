import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateICPDto } from './create-icp.dto';

export class UpdateICPDto extends PartialType(CreateICPDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
