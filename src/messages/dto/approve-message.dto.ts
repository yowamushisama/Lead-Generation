import { IsOptional, IsString } from 'class-validator';

export class ApproveMessageDto {
  @IsOptional()
  @IsString()
  editedBody?: string;

  @IsOptional()
  @IsString()
  editedSubject?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
