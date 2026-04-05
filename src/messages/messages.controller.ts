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
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { ApproveMessageDto } from './dto/approve-message.dto';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('api/v1/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a message draft' })
  create(@Tenant() tenant: TenantContext, @Body() dto: CreateMessageDto) {
    return this.messagesService.create(tenant, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List messages' })
  findAll(
    @Tenant() tenant: TenantContext,
    @Query('leadId') leadId?: string,
    @Query('status') status?: string,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.messagesService.findAll(tenant, { leadId, status, campaignId });
  }

  @Get('pending-approval')
  @ApiOperation({ summary: 'Get messages pending human approval' })
  getPendingApproval(@Tenant() tenant: TenantContext) {
    return this.messagesService.getPendingApproval(tenant);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a message by ID' })
  findOne(@Tenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.messagesService.findOne(tenant, id);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve (and optionally edit) a message' })
  approve(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveMessageDto,
  ) {
    return this.messagesService.approve(tenant, id, dto);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a message' })
  reject(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('reason') reason?: string,
  ) {
    return this.messagesService.reject(tenant, id, reason);
  }

  @Patch(':id/sent')
  @ApiOperation({ summary: 'Mark a message as sent' })
  markSent(@Tenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.messagesService.markSent(tenant, id);
  }
}
