import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { LeadsService, LeadStats } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadFilterDto } from './dto/lead-filter.dto';
import { LeadDetailResponseDto } from './dto/lead-response.dto';
import { LeadQueryDto } from './dto/lead-query.dto';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { Lead } from '@prisma/client';
import { ReportArtifactRepository } from '../database/repositories/report-artifact.repository';
import { MessageRepository } from '../database/repositories/message.repository';
import { DeepReportGeneratorStage } from '../pipeline/stages/deep-report-generator.stage';
import { UnprocessableEntityException } from '@nestjs/common';

@ApiTags('leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly reportRepository: ReportArtifactRepository,
    private readonly messageRepository: MessageRepository,
    private readonly deepReportStage: DeepReportGeneratorStage,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new lead' })
  @ApiResponse({ status: 201, description: 'Lead created successfully' })
  @ApiResponse({ status: 409, description: 'Duplicate lead' })
  async create(
    @Tenant() tenant: TenantContext,
    @Body() dto: CreateLeadDto,
  ): Promise<ApiResponseDto<Lead>> {
    const result = await this.leadsService.create(tenant, dto);
    return ApiResponseDto.success(result, 'Lead created');
  }

  @Get()
  @ApiOperation({ summary: 'List leads with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Leads retrieved' })
  async findAll(
    @Tenant() tenant: TenantContext,
    @Query() query: LeadQueryDto,
  ): Promise<ApiResponseDto<PaginatedResult<Lead>>> {
    const result = await this.leadsService.findAll(tenant, query, query);
    return ApiResponseDto.success(result);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get lead statistics for the organization' })
  async getStats(@Tenant() tenant: TenantContext): Promise<ApiResponseDto<LeadStats>> {
    const result = await this.leadsService.getStats(tenant.organizationId);
    return ApiResponseDto.success(result);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a lead by ID' })
  @ApiResponse({ status: 200, description: 'Lead retrieved', type: LeadDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async findOne(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<LeadDetailResponseDto>> {
    const result = await this.leadsService.findOne(tenant.organizationId, id);
    return ApiResponseDto.success(result);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a lead' })
  @ApiResponse({ status: 200, description: 'Lead updated' })
  async update(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadDto,
  ): Promise<ApiResponseDto<Lead>> {
    const result = await this.leadsService.update(tenant.organizationId, id, dto);
    return ApiResponseDto.success(result, 'Lead updated');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a lead' })
  @ApiResponse({ status: 204, description: 'Lead deleted' })
  async remove(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.leadsService.remove(tenant.organizationId, id);
  }

  @Post(':id/opt-out')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a lead as opted out (GDPR/CAN-SPAM)' })
  async optOut(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<Lead>> {
    const result = await this.leadsService.optOut(tenant.organizationId, id);
    return ApiResponseDto.success(result, 'Lead opted out');
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk create leads' })
  @ApiResponse({ status: 201, description: 'Bulk creation result' })
  async bulkCreate(
    @Tenant() tenant: TenantContext,
    @Body() dtos: CreateLeadDto[],
  ): Promise<ApiResponseDto<{ created: number; duplicates: number; errors: number }>> {
    const result = await this.leadsService.bulkCreate(tenant, dtos);
    return ApiResponseDto.success(result, 'Bulk creation completed');
  }

  @Get(':id/reports')
  @ApiOperation({ summary: 'Get the latest website-audit report for a lead (markdown + structured insights)' })
  async getReports(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<unknown>> {
    // Verify the lead belongs to the tenant before exposing its reports
    await this.leadsService.findOne(tenant.organizationId, id);

    const [latest, versions] = await Promise.all([
      this.reportRepository.findLatest(id, 'WEBSITE_REPORT'),
      this.reportRepository.findAllVersions(id, 'WEBSITE_REPORT'),
    ]);

    return ApiResponseDto.success({
      latest,
      versionCount: versions.length,
      versions: versions.map((v) => ({
        id: v.id,
        version: v.version,
        generatedAt: v.generatedAt,
      })),
    });
  }

  @Post(':id/reports/regenerate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Regenerate the website-audit report for a lead' })
  @ApiResponse({ status: 200, description: 'Report regenerated' })
  @ApiResponse({ status: 422, description: 'Lead has no website audit data' })
  async regenerateReport(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<unknown>> {
    const lead = await this.leadsService.findOne(tenant.organizationId, id);

    const websiteAudit = (lead as any).websiteAudit as {
      title?: string | null;
      metaDescription?: string | null;
      loadMs?: number | null;
      techStack?: string[];
      ctaPresent?: boolean;
      deepSignals?: Record<string, unknown>;
    } | null;

    if (!websiteAudit?.deepSignals) {
      throw new UnprocessableEntityException(
        'Lead has no website audit data — run enrichment first',
      );
    }

    const result = await this.deepReportStage.process(
      {
        leadId: id,
        organizationId: tenant.organizationId,
        campaignId: (lead as any).campaignId ?? null,
        promptInput: {
          leadName: lead.name,
          company: lead.company,
          industry: lead.industry,
          location: lead.location,
          googleTypes: (lead as any).googleTypes ?? [],
          rating: (lead as any).rating ?? null,
          reviewCount: (lead as any).reviewCount ?? null,
          lastReviewAt: (lead as any).lastReviewAt
            ? new Date((lead as any).lastReviewAt as string).toISOString().slice(0, 10)
            : null,
          businessHours: (lead as any).businessHours ?? null,
          websiteUrl: lead.website,
          websiteAuditSummary: {
            title: websiteAudit.title,
            metaDescription: websiteAudit.metaDescription,
            loadMs: websiteAudit.loadMs,
            techStack: websiteAudit.techStack,
            ctaPresent: websiteAudit.ctaPresent,
          },
          deepSignals: websiteAudit.deepSignals as any,
          campaignName: null,
          targetIndustries: [],
          serviceOffering: null,
          uniqueValue: null,
        },
      },
      tenant,
    );

    return ApiResponseDto.success(result);
  }

  @Get(':id/cold-call-script')
  @ApiOperation({ summary: 'Get the latest cold-call script Message for a lead' })
  async getColdCallScript(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<unknown>> {
    await this.leadsService.findOne(tenant.organizationId, id);

    const script = await this.messageRepository.findFirst({
      where: { leadId: id, type: 'COLD_CALL_SCRIPT' },
      orderBy: { generatedAt: 'desc' },
    });

    return ApiResponseDto.success(script);
  }
}
