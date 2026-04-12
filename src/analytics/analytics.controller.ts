import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import {
  DashboardResponseDto,
  FunnelStageDto,
  SourceBreakdownDto,
  TrendRowDto,
} from './dto/analytics-response.dto';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: '30-day overview dashboard',
    description: 'Returns aggregated lead counts, outreach metrics, and AI usage for the last 30 days.',
  })
  @ApiResponse({ status: 200, description: 'Dashboard data returned successfully.', type: ApiResponseDto<DashboardResponseDto> })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async getDashboard(@Tenant() tenant: TenantContext): Promise<ApiResponseDto<DashboardResponseDto>> {
    const data = await this.analyticsService.getDashboard(tenant);
    return ApiResponseDto.success(data as DashboardResponseDto);
  }

  @Get('funnel')
  @ApiOperation({
    summary: 'Lead pipeline funnel',
    description: 'Returns per-stage lead counts from NEW through CONVERTED.',
  })
  @ApiResponse({ status: 200, description: 'Funnel stages returned.', type: ApiResponseDto<FunnelStageDto[]> })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async getFunnel(@Tenant() tenant: TenantContext): Promise<ApiResponseDto<FunnelStageDto[]>> {
    const data = await this.analyticsService.getFunnel(tenant);
    return ApiResponseDto.success(data as FunnelStageDto[]);
  }

  @Get('sources')
  @ApiOperation({
    summary: 'Lead source breakdown',
    description: 'Returns lead counts grouped by acquisition source (LinkedIn, Google Maps, CSV, Webhook).',
  })
  @ApiResponse({ status: 200, description: 'Source breakdown returned.', type: ApiResponseDto<SourceBreakdownDto[]> })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async getSources(@Tenant() tenant: TenantContext): Promise<ApiResponseDto<SourceBreakdownDto[]>> {
    const data = await this.analyticsService.getLeadSourceBreakdown(tenant);
    return ApiResponseDto.success(data as SourceBreakdownDto[]);
  }

  @Get('trend')
  @ApiOperation({
    summary: 'Daily lead volume trend',
    description: 'Returns daily new-lead counts and AI token usage for the requested look-back window.',
  })
  @ApiQuery({ name: 'days', required: false, example: 14, description: 'Number of days to look back (default: 14).' })
  @ApiResponse({ status: 200, description: 'Trend data returned.', type: ApiResponseDto<TrendRowDto[]> })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async getTrend(
    @Tenant() tenant: TenantContext,
    @Query('days') days?: string,
  ): Promise<ApiResponseDto<TrendRowDto[]>> {
    const raw = await this.analyticsService.getDailyTrend(tenant, days ? parseInt(days, 10) : 14);
    // Prisma returns aiTokensUsed as bigint — serialise to string for JSON transport
    const data: TrendRowDto[] = raw.map((r) => ({
      date: r.date,
      leadsProcessed: r.leadsProcessed,
      aiTokensUsed: r.aiTokensUsed.toString(),
    }));
    return ApiResponseDto.success(data);
  }
}
