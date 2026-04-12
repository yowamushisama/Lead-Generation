import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { ApproveMessageDto } from './dto/approve-message.dto';
import { MessageResponseDto, MessageWithLeadDto } from './dto/message-response.dto';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { ApiResponseDto } from '../common/dto/api-response.dto';

@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a message draft', description: 'Creates a new AI-generated message draft for a lead.' })
  @ApiResponse({ status: 201, description: 'Message draft created.', type: ApiResponseDto<MessageResponseDto> })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async create(
    @Tenant() tenant: TenantContext,
    @Body() dto: CreateMessageDto,
  ): Promise<ApiResponseDto<MessageResponseDto>> {
    const data = await this.messagesService.create(tenant, dto);
    return ApiResponseDto.success(data as MessageResponseDto, 'Message created');
  }

  @Get()
  @ApiOperation({
    summary: 'List messages',
    description: 'Returns messages for the tenant, optionally filtered by leadId, status, or campaignId.',
  })
  @ApiQuery({ name: 'leadId', required: false, description: 'Filter messages by lead UUID.' })
  @ApiQuery({ name: 'status', required: false, example: 'PENDING_APPROVAL', description: 'Filter by message status.' })
  @ApiQuery({ name: 'campaignId', required: false, description: 'Filter messages by campaign UUID.' })
  @ApiResponse({ status: 200, description: 'Message list returned.', type: ApiResponseDto<MessageResponseDto[]> })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async findAll(
    @Tenant() tenant: TenantContext,
    @Query('leadId') leadId?: string,
    @Query('status') status?: string,
    @Query('campaignId') campaignId?: string,
  ): Promise<ApiResponseDto<MessageResponseDto[]>> {
    const data = await this.messagesService.findAll(tenant, { leadId, status, campaignId });
    return ApiResponseDto.success(data as MessageResponseDto[]);
  }

  @Get('pending-approval')
  @ApiOperation({
    summary: 'Get messages pending human approval',
    description: 'Returns all messages in PENDING_APPROVAL status that require a human review before sending. Each entry includes an embedded lead summary (name, role, company, score, tier).',
  })
  @ApiResponse({ status: 200, description: 'Pending messages returned.', type: ApiResponseDto<MessageWithLeadDto[]> })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async getPendingApproval(
    @Tenant() tenant: TenantContext,
  ): Promise<ApiResponseDto<MessageWithLeadDto[]>> {
    const data = await this.messagesService.getPendingApproval(tenant);
    return ApiResponseDto.success(data as MessageWithLeadDto[]);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a message by ID' })
  @ApiParam({ name: 'id', description: 'Message UUID' })
  @ApiResponse({ status: 200, description: 'Message returned.', type: ApiResponseDto<MessageResponseDto> })
  @ApiResponse({ status: 404, description: 'Message not found.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async findOne(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<MessageResponseDto>> {
    const data = await this.messagesService.findOne(tenant, id);
    return ApiResponseDto.success(data as MessageResponseDto);
  }

  @Patch(':id/approve')
  @ApiOperation({
    summary: 'Approve a message',
    description: 'Approves a pending message for sending. Optionally accepts an edited body, subject, or internal note.',
  })
  @ApiParam({ name: 'id', description: 'Message UUID' })
  @ApiResponse({ status: 200, description: 'Message approved.', type: ApiResponseDto<MessageResponseDto> })
  @ApiResponse({ status: 404, description: 'Message not found.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async approve(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveMessageDto,
  ): Promise<ApiResponseDto<MessageResponseDto>> {
    const data = await this.messagesService.approve(tenant, id, dto);
    return ApiResponseDto.success(data as MessageResponseDto, 'Message approved');
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a message', description: 'Rejects a pending message with an optional reason.' })
  @ApiParam({ name: 'id', description: 'Message UUID' })
  @ApiQuery({ name: 'reason', required: false, description: 'Human-readable rejection reason.' })
  @ApiResponse({ status: 200, description: 'Message rejected.', type: ApiResponseDto<MessageResponseDto> })
  @ApiResponse({ status: 404, description: 'Message not found.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async reject(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('reason') reason?: string,
  ): Promise<ApiResponseDto<MessageResponseDto>> {
    const data = await this.messagesService.reject(tenant, id, reason);
    return ApiResponseDto.success(data as MessageResponseDto, 'Message rejected');
  }

  @Patch(':id/sent')
  @ApiOperation({
    summary: 'Mark a message as sent',
    description: 'Marks a previously approved message as SENT after the adapter has delivered it.',
  })
  @ApiParam({ name: 'id', description: 'Message UUID' })
  @ApiResponse({ status: 200, description: 'Message marked as sent.', type: ApiResponseDto<MessageResponseDto> })
  @ApiResponse({ status: 404, description: 'Message not found.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async markSent(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<MessageResponseDto>> {
    const data = await this.messagesService.markSent(tenant, id);
    return ApiResponseDto.success(data as MessageResponseDto, 'Message marked as sent');
  }
}
