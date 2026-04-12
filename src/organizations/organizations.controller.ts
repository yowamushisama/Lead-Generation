import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import {
  OrganizationResponseDto,
  OrgStatsResponseDto,
} from './dto/organization-response.dto';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { ApiResponseDto } from '../common/dto/api-response.dto';

@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @Roles('superadmin')
  @ApiOperation({ summary: 'Create a new organisation (superadmin only)' })
  @ApiResponse({ status: 201, description: 'Organisation created.', type: ApiResponseDto<OrganizationResponseDto> })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 403, description: 'Insufficient role.' })
  async create(@Body() dto: CreateOrganizationDto): Promise<ApiResponseDto<OrganizationResponseDto>> {
    const result = await this.organizationsService.create(dto);
    return ApiResponseDto.success(result, 'Organisation created');
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current organisation profile' })
  @ApiResponse({ status: 200, description: 'Organisation returned.', type: ApiResponseDto<OrganizationResponseDto> })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async getMyOrganization(
    @Tenant() tenant: TenantContext,
  ): Promise<ApiResponseDto<OrganizationResponseDto>> {
    const result = await this.organizationsService.findById(tenant.organizationId);
    return ApiResponseDto.success(result);
  }

  @Get('me/stats')
  @ApiOperation({
    summary: 'Get organisation usage statistics',
    description:
      'Returns nested stats: organisation tier/limits, today\'s lead counts, and today\'s AI usage (tokens, cost, scrapes).',
  })
  @ApiResponse({ status: 200, description: 'Stats returned.', type: ApiResponseDto<OrgStatsResponseDto> })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async getStats(
    @Tenant() tenant: TenantContext,
  ): Promise<ApiResponseDto<OrgStatsResponseDto>> {
    const result = await this.organizationsService.getStats(tenant.organizationId);
    return ApiResponseDto.success(result);
  }

  @Get(':id')
  @Roles('superadmin')
  @ApiOperation({ summary: 'Get organisation by ID (superadmin only)' })
  @ApiParam({ name: 'id', description: 'Organisation UUID' })
  @ApiResponse({ status: 200, description: 'Organisation returned.', type: ApiResponseDto<OrganizationResponseDto> })
  @ApiResponse({ status: 404, description: 'Organisation not found.' })
  @ApiResponse({ status: 403, description: 'Insufficient role.' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<OrganizationResponseDto>> {
    const result = await this.organizationsService.findById(id);
    return ApiResponseDto.success(result);
  }

  @Patch('me')
  @Roles('admin')
  @ApiOperation({ summary: 'Update current organisation' })
  @ApiResponse({ status: 200, description: 'Organisation updated.', type: ApiResponseDto<OrganizationResponseDto> })
  @ApiResponse({ status: 403, description: 'Insufficient role.' })
  async updateMyOrganization(
    @Tenant() tenant: TenantContext,
    @Body() dto: UpdateOrganizationDto,
  ): Promise<ApiResponseDto<OrganizationResponseDto>> {
    const result = await this.organizationsService.update(tenant.organizationId, dto);
    return ApiResponseDto.success(result, 'Organisation updated');
  }

  @Patch(':id')
  @Roles('superadmin')
  @ApiOperation({ summary: 'Update organisation by ID (superadmin only)' })
  @ApiParam({ name: 'id', description: 'Organisation UUID' })
  @ApiResponse({ status: 200, description: 'Organisation updated.', type: ApiResponseDto<OrganizationResponseDto> })
  @ApiResponse({ status: 404, description: 'Organisation not found.' })
  @ApiResponse({ status: 403, description: 'Insufficient role.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
  ): Promise<ApiResponseDto<OrganizationResponseDto>> {
    const result = await this.organizationsService.update(id, dto);
    return ApiResponseDto.success(result, 'Organisation updated');
  }
}
