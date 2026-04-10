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
} from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
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
  @ApiOperation({ summary: 'Create a new organization (superadmin only)' })
  @ApiResponse({ status: 201, description: 'Organization created successfully' })
  async create(
    @Body() dto: CreateOrganizationDto,
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.organizationsService.create(dto);
    return ApiResponseDto.success(result, 'Organization created');
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current organization profile' })
  @ApiResponse({ status: 200, description: 'Organization retrieved' })
  async getMyOrganization(
    @Tenant() tenant: TenantContext,
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.organizationsService.findById(tenant.organizationId);
    return ApiResponseDto.success(result);
  }

  @Get(':id')
  @Roles('superadmin')
  @ApiOperation({ summary: 'Get organization by ID (superadmin only)' })
  @ApiResponse({ status: 200, description: 'Organization retrieved' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.organizationsService.findById(id);
    return ApiResponseDto.success(result);
  }

  @Patch('me')
  @Roles('admin')
  @ApiOperation({ summary: 'Update current organization' })
  @ApiResponse({ status: 200, description: 'Organization updated' })
  async updateMyOrganization(
    @Tenant() tenant: TenantContext,
    @Body() dto: UpdateOrganizationDto,
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.organizationsService.update(tenant.organizationId, dto);
    return ApiResponseDto.success(result, 'Organization updated');
  }

  @Patch(':id')
  @Roles('superadmin')
  @ApiOperation({ summary: 'Update organization by ID (superadmin only)' })
  @ApiResponse({ status: 200, description: 'Organization updated' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.organizationsService.update(id, dto);
    return ApiResponseDto.success(result, 'Organization updated');
  }

  @Get('me/stats')
  @ApiOperation({ summary: 'Get organization usage statistics' })
  async getStats(
    @Tenant() tenant: TenantContext,
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.organizationsService.getStats(tenant.organizationId);
    return ApiResponseDto.success(result);
  }
}
