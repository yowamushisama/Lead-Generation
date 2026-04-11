import { Controller, Get, Post, Delete, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ComplianceService } from './compliance.service';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@ApiTags('compliance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('api/v1/compliance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Get('retention-summary')
  @ApiOperation({ summary: 'Get data retention summary' })
  getRetentionSummary(@Tenant() tenant: TenantContext) {
    return this.complianceService.getRetentionSummary(tenant);
  }

  @Post('opt-out/:leadId')
  @ApiOperation({ summary: 'Process opt-out request for a lead (GDPR)' })
  processOptOut(@Tenant() tenant: TenantContext, @Param('leadId', ParseUUIDPipe) leadId: string) {
    return this.complianceService.processOptOut(tenant, leadId);
  }

  @Get('export/:leadId')
  @ApiOperation({ summary: 'Export all data for a lead (GDPR right of access)' })
  exportLeadData(@Tenant() tenant: TenantContext, @Param('leadId', ParseUUIDPipe) leadId: string) {
    return this.complianceService.exportLeadData(tenant, leadId);
  }

  @Delete('leads/:leadId')
  @ApiOperation({ summary: 'Permanently delete lead data (GDPR right to erasure)' })
  deleteLeadData(@Tenant() tenant: TenantContext, @Param('leadId', ParseUUIDPipe) leadId: string) {
    return this.complianceService.deleteLeadData(tenant, leadId);
  }
}
