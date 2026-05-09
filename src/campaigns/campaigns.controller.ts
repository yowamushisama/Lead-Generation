import {
  Controller,
  Get,
  Post,
  Patch,
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
} from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CampaignFilterDto } from './dto/campaign-filter.dto';
import { CampaignResponseDto, CampaignPerformanceResponseDto } from './dto/campaign-response.dto';
import { CampaignRunSummaryDto } from './dto/campaign-run-summary.dto';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { ApiResponseDto } from '../common/dto/api-response.dto';

@ApiTags('campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a campaign', description: 'Creates a new outreach campaign for the tenant.' })
  @ApiResponse({ status: 201, description: 'Campaign created.', type: ApiResponseDto<CampaignResponseDto> })
  @ApiResponse({ status: 400, description: 'Validation error in request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async create(
    @Tenant() tenant: TenantContext,
    @Body() dto: CreateCampaignDto,
  ): Promise<ApiResponseDto<CampaignResponseDto>> {
    const data = await this.campaignsService.create(tenant, dto);
    return ApiResponseDto.success(data as CampaignResponseDto, 'Campaign created');
  }

  @Get()
  @ApiOperation({
    summary: 'List campaigns',
    description:
      'Returns all campaigns for the tenant. Each campaign includes live outreach metrics (leadsGenerated, messagesSent, replies, conversions) computed from the database.',
  })
  @ApiQuery({ name: 'status', required: false, example: 'ACTIVE', description: 'Filter by campaign status.' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'Filter by active/inactive state.' })
  @ApiResponse({ status: 200, description: 'Campaign list returned.', type: ApiResponseDto<CampaignResponseDto[]> })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async findAll(
    @Tenant() tenant: TenantContext,
    @Query() filters: CampaignFilterDto,
  ): Promise<ApiResponseDto<CampaignResponseDto[]>> {
    const data = await this.campaignsService.findAll(tenant, filters);
    return ApiResponseDto.success(data as CampaignResponseDto[]);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a campaign by ID' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  @ApiResponse({ status: 200, description: 'Campaign returned.', type: ApiResponseDto<CampaignResponseDto> })
  @ApiResponse({ status: 404, description: 'Campaign not found.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async findOne(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<CampaignResponseDto>> {
    const data = await this.campaignsService.findOne(tenant, id);
    return ApiResponseDto.success(data as CampaignResponseDto);
  }

  @Get(':id/performance')
  @ApiOperation({
    summary: 'Get campaign performance metrics',
    description:
      'Returns detailed lead-status breakdown, message-status breakdown, and computed KPIs (replyRate, conversionRate).',
  })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  @ApiResponse({ status: 200, description: 'Performance metrics returned.', type: ApiResponseDto<CampaignPerformanceResponseDto> })
  @ApiResponse({ status: 404, description: 'Campaign not found.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async getPerformance(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<CampaignPerformanceResponseDto>> {
    const data = await this.campaignsService.getPerformance(tenant, id);
    return ApiResponseDto.success(data as CampaignPerformanceResponseDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a campaign', description: 'Partially updates campaign fields (name, description, icpProfileId).' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  @ApiResponse({ status: 200, description: 'Campaign updated.', type: ApiResponseDto<CampaignResponseDto> })
  @ApiResponse({ status: 404, description: 'Campaign not found.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async update(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateCampaignDto>,
  ): Promise<ApiResponseDto<CampaignResponseDto>> {
    const data = await this.campaignsService.update(tenant, id, dto);
    return ApiResponseDto.success(data as CampaignResponseDto, 'Campaign updated');
  }

  @Patch(':id/pause')
  @ApiOperation({ summary: 'Pause a campaign', description: 'Sets campaign status to PAUSED and isActive to false.' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  @ApiResponse({ status: 200, description: 'Campaign paused.', type: ApiResponseDto<CampaignResponseDto> })
  @ApiResponse({ status: 404, description: 'Campaign not found.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async pause(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<CampaignResponseDto>> {
    const data = await this.campaignsService.pause(tenant, id);
    return ApiResponseDto.success(data as CampaignResponseDto, 'Campaign paused');
  }

  @Patch(':id/launch')
  @ApiOperation({ summary: 'Launch a draft campaign', description: 'Transitions a DRAFT campaign to ACTIVE. Only valid for DRAFT campaigns.' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  @ApiResponse({ status: 200, description: 'Campaign launched.', type: ApiResponseDto<CampaignResponseDto> })
  @ApiResponse({ status: 403, description: 'Campaign is not in DRAFT status.' })
  @ApiResponse({ status: 404, description: 'Campaign not found.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async launch(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<CampaignResponseDto>> {
    const data = await this.campaignsService.launch(tenant, id);
    return ApiResponseDto.success(data as CampaignResponseDto, 'Campaign launched');
  }

  @Post(':id/run')
  @ApiOperation({
    summary: 'Manually trigger the collection pipeline',
    description:
      'Runs every configured adapter for an ACTIVE campaign on demand, persists each discovered lead, then enqueues new leads to the intent stage. Returns a summary of adapters used, skipped reasons, saved leads, duplicates, errors, and enqueued jobs.',
  })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  @ApiResponse({ status: 200, description: 'Run completed (leads saved and enqueued).', type: ApiResponseDto<CampaignRunSummaryDto> })
  @ApiResponse({ status: 403, description: 'Campaign is not ACTIVE.' })
  @ApiResponse({ status: 404, description: 'Campaign not found.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async runManually(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<CampaignRunSummaryDto>> {
    const summary = await this.campaignsService.runManually(tenant, id);
    return ApiResponseDto.success(summary as CampaignRunSummaryDto, 'Campaign run started');
  }

  @Patch(':id/resume')
  @ApiOperation({ summary: 'Resume a paused campaign', description: 'Transitions a PAUSED campaign back to ACTIVE. Only valid for PAUSED campaigns.' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  @ApiResponse({ status: 200, description: 'Campaign resumed.', type: ApiResponseDto<CampaignResponseDto> })
  @ApiResponse({ status: 403, description: 'Campaign is not in PAUSED status.' })
  @ApiResponse({ status: 404, description: 'Campaign not found.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async resume(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<CampaignResponseDto>> {
    const data = await this.campaignsService.resume(tenant, id);
    return ApiResponseDto.success(data as CampaignResponseDto, 'Campaign resumed');
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archive a campaign', description: 'Sets campaign status to ARCHIVED and isActive to false. Archived campaigns are read-only.' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  @ApiResponse({ status: 200, description: 'Campaign archived.', type: ApiResponseDto<CampaignResponseDto> })
  @ApiResponse({ status: 404, description: 'Campaign not found.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async archive(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<CampaignResponseDto>> {
    const data = await this.campaignsService.archive(tenant, id);
    return ApiResponseDto.success(data as CampaignResponseDto, 'Campaign archived');
  }
}
