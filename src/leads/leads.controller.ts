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
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadFilterDto } from './dto/lead-filter.dto';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new lead' })
  @ApiResponse({ status: 201, description: 'Lead created successfully' })
  @ApiResponse({ status: 409, description: 'Duplicate lead' })
  async create(
    @Tenant() tenant: TenantContext,
    @Body() dto: CreateLeadDto,
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.leadsService.create(tenant, dto);
    return ApiResponseDto.success(result, 'Lead created');
  }

  @Get()
  @ApiOperation({ summary: 'List leads with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Leads retrieved' })
  async findAll(
    @Tenant() tenant: TenantContext,
    @Query() filter: LeadFilterDto,
    @Query() pagination: PaginationDto,
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.leadsService.findAll(tenant, filter, pagination);
    return ApiResponseDto.success(result);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get lead statistics for the organization' })
  async getStats(@Tenant() tenant: TenantContext): Promise<ApiResponseDto<unknown>> {
    const result = await this.leadsService.getStats(tenant.organizationId);
    return ApiResponseDto.success(result);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a lead by ID' })
  @ApiResponse({ status: 200, description: 'Lead retrieved' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async findOne(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<unknown>> {
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
  ): Promise<ApiResponseDto<unknown>> {
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
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.leadsService.optOut(tenant.organizationId, id);
    return ApiResponseDto.success(result, 'Lead opted out');
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk create leads' })
  @ApiResponse({ status: 201, description: 'Bulk creation result' })
  async bulkCreate(
    @Tenant() tenant: TenantContext,
    @Body() dtos: CreateLeadDto[],
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.leadsService.bulkCreate(tenant, dtos);
    return ApiResponseDto.success(result, 'Bulk creation completed');
  }
}
