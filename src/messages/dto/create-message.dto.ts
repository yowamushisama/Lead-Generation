import { IsString, IsOptional, IsUUID, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { MessageStatus } from '../../common/enums/message-status.enum';

export class CreateMessageDto {
  @IsUUID()
  leadId!: string;

  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsString()
  channel!: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  spamScore?: number;

  @IsOptional()
  @IsEnum(MessageStatus)
  status?: MessageStatus;
}
