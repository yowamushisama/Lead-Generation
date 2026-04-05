import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('api/v1/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: '30-day overview dashboard' })
  getDashboard(@Tenant() tenant: TenantContext) {
    return this.analyticsService.getDashboard(tenant);
  }

  @Get('funnel')
  @ApiOperation({ summary: 'Lead pipeline funnel view' })
  getFunnel(@Tenant() tenant: TenantContext) {
    return this.analyticsService.getFunnel(tenant);
  }

  @Get('sources')
  @ApiOperation({ summary: 'Lead source breakdown' })
  getSources(@Tenant() tenant: TenantContext) {
    return this.analyticsService.getLeadSourceBreakdown(tenant);
  }

  @Get('trend')
  @ApiOperation({ summary: 'Daily lead volume trend' })
  getTrend(@Tenant() tenant: TenantContext, @Query('days') days?: string) {
    return this.analyticsService.getDailyTrend(tenant, days ? parseInt(days, 10) : 14);
  }
}
