import {
  Controller,
  Get,
  Post,
  Body,
  Param,
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
  ApiBody,
} from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import {
  ConversationResponseDto,
  ReplySuggestionsResponseDto,
} from './dto/conversation-response.dto';

@ApiTags('conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @ApiOperation({
    summary: 'Start a new conversation thread',
    description: 'Creates a conversation record for a lead on the given channel.',
  })
  @ApiBody({
    schema: {
      properties: {
        leadId: { type: 'string', format: 'uuid' },
        channel: { type: 'string', example: 'linkedin-dm' },
      },
      required: ['leadId', 'channel'],
    },
  })
  @ApiResponse({ status: 201, description: 'Conversation created.', type: ApiResponseDto<ConversationResponseDto> })
  @ApiResponse({ status: 404, description: 'Lead not found.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async create(
    @Tenant() tenant: TenantContext,
    @Body() body: { leadId: string; channel: string },
  ): Promise<ApiResponseDto<ConversationResponseDto>> {
    const data = await this.conversationsService.create(tenant, body.leadId, body.channel);
    return ApiResponseDto.success(data, 'Conversation started');
  }

  @Get()
  @ApiOperation({
    summary: 'List conversations',
    description:
      'Returns conversations for the tenant. Each entry includes a lead summary (name, role, company, score, tier).',
  })
  @ApiQuery({ name: 'leadId', required: false, description: 'Filter by lead UUID.' })
  @ApiQuery({ name: 'status', required: false, example: 'ACTIVE', description: 'Filter by conversation status (ACTIVE | CLOSED).' })
  @ApiResponse({ status: 200, description: 'Conversation list returned.', type: ApiResponseDto<ConversationResponseDto[]> })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async findAll(
    @Tenant() tenant: TenantContext,
    @Query('leadId') leadId?: string,
    @Query('status') status?: string,
  ): Promise<ApiResponseDto<ConversationResponseDto[]>> {
    const data = await this.conversationsService.findAll(tenant, { leadId, status });
    return ApiResponseDto.success(data);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a conversation by ID',
    description: 'Returns a single conversation with full lead details and message history.',
  })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiResponse({ status: 200, description: 'Conversation returned.', type: ApiResponseDto<ConversationResponseDto> })
  @ApiResponse({ status: 404, description: 'Conversation not found.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async findOne(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<ConversationResponseDto>> {
    const data = await this.conversationsService.findOne(tenant, id);
    return ApiResponseDto.success(data);
  }

  @Get(':id/reply-suggestions')
  @ApiOperation({
    summary: 'Get AI-suggested replies',
    description:
      'Analyses the latest incoming message and returns AI-generated reply suggestions, objection detection result, and recommended approach.',
  })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiResponse({ status: 200, description: 'Reply suggestions returned.', type: ApiResponseDto<ReplySuggestionsResponseDto> })
  @ApiResponse({ status: 404, description: 'Conversation not found.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async getSuggestedReplies(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<ReplySuggestionsResponseDto>> {
    const data = await this.conversationsService.getSuggestedReplies(tenant, id);
    return ApiResponseDto.success(data);
  }

  @Post(':id/messages')
  @ApiOperation({
    summary: 'Add a message to the conversation',
    description: 'Appends a message to the thread. Set fromUs: true for outbound messages, false for inbound lead replies.',
  })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiBody({
    schema: {
      properties: {
        content: { type: 'string', description: 'Message text' },
        fromUs: { type: 'boolean', description: 'true = sent by us, false = received from lead' },
      },
      required: ['content', 'fromUs'],
    },
  })
  @ApiResponse({ status: 201, description: 'Message added.', type: ApiResponseDto<ConversationResponseDto> })
  @ApiResponse({ status: 404, description: 'Conversation not found.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async addReply(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { content: string; fromUs: boolean },
  ): Promise<ApiResponseDto<ConversationResponseDto>> {
    const data = await this.conversationsService.addReply(tenant, id, body.content, body.fromUs);
    return ApiResponseDto.success(data, 'Message added');
  }
}
