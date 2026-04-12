import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ComplianceService } from './compliance.service';
import { RetentionSummaryDto, LeadExportResponseDto } from './dto/compliance-response.dto';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { ApiResponseDto } from '../common/dto/api-response.dto';

@ApiTags('compliance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Get('retention-summary')
  @ApiOperation({
    summary: 'Get data retention summary',
    description:
      'Returns counts of total leads, opted-out leads, and leads whose data expires within the next 7 days, plus the configured retention policy window.',
  })
  @ApiResponse({ status: 200, description: 'Retention summary returned.', type: ApiResponseDto<RetentionSummaryDto> })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async getRetentionSummary(
    @Tenant() tenant: TenantContext,
  ): Promise<ApiResponseDto<RetentionSummaryDto>> {
    const data = await this.complianceService.getRetentionSummary(tenant);
    return ApiResponseDto.success(data as RetentionSummaryDto);
  }

  @Post('opt-out/:leadId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process opt-out for a lead (GDPR)',
    description:
      'Marks the lead as opted-out, cancels all in-flight messages, and sets a 30-day data expiry. Idempotent.',
  })
  @ApiParam({ name: 'leadId', description: 'Lead UUID' })
  @ApiResponse({ status: 200, description: 'Opt-out processed.' })
  @ApiResponse({ status: 404, description: 'Lead not found.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async processOptOut(
    @Tenant() tenant: TenantContext,
    @Param('leadId', ParseUUIDPipe) leadId: string,
  ): Promise<ApiResponseDto<null>> {
    await this.complianceService.processOptOut(tenant, leadId);
    return ApiResponseDto.success(null, 'Opt-out processed');
  }

  @Get('export/:leadId')
  @ApiOperation({
    summary: 'Export lead data (GDPR right of access)',
    description: 'Returns all stored data for a lead, including messages and conversation history.',
  })
  @ApiParam({ name: 'leadId', description: 'Lead UUID' })
  @ApiResponse({ status: 200, description: 'Lead data exported.', type: ApiResponseDto<LeadExportResponseDto> })
  @ApiResponse({ status: 404, description: 'Lead not found.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async exportLeadData(
    @Tenant() tenant: TenantContext,
    @Param('leadId', ParseUUIDPipe) leadId: string,
  ): Promise<ApiResponseDto<LeadExportResponseDto>> {
    const data = await this.complianceService.exportLeadData(tenant, leadId);
    return ApiResponseDto.success(data);
  }

  @Delete('leads/:leadId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Permanently delete lead data (GDPR right to erasure)',
    description: 'Permanently removes the lead and all associated messages and conversations. Irreversible.',
  })
  @ApiParam({ name: 'leadId', description: 'Lead UUID' })
  @ApiResponse({ status: 200, description: 'Lead data deleted.' })
  @ApiResponse({ status: 404, description: 'Lead not found.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async deleteLeadData(
    @Tenant() tenant: TenantContext,
    @Param('leadId', ParseUUIDPipe) leadId: string,
  ): Promise<ApiResponseDto<null>> {
    await this.complianceService.deleteLeadData(tenant, leadId);
    return ApiResponseDto.success(null, 'Lead data deleted');
  }
}
