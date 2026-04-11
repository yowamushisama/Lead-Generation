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
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@ApiTags('conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('api/v1/conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @ApiOperation({ summary: 'Start a new conversation thread' })
  create(@Tenant() tenant: TenantContext, @Body() body: { leadId: string; channel: string }) {
    return this.conversationsService.create(tenant, body.leadId, body.channel);
  }

  @Get()
  @ApiOperation({ summary: 'List conversations' })
  findAll(
    @Tenant() tenant: TenantContext,
    @Query('leadId') leadId?: string,
    @Query('status') status?: string,
  ) {
    return this.conversationsService.findAll(tenant, { leadId, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a conversation by ID' })
  findOne(@Tenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.conversationsService.findOne(tenant, id);
  }

  @Get(':id/reply-suggestions')
  @ApiOperation({ summary: 'Get AI-suggested replies for latest incoming message' })
  getSuggestedReplies(@Tenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.conversationsService.getSuggestedReplies(tenant, id);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Add a message to the conversation' })
  addReply(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { content: string; fromUs: boolean },
  ) {
    return this.conversationsService.addReply(tenant, id, body.content, body.fromUs);
  }
}
