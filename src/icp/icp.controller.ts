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
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ICPService, CreateICPDto, UpdateICPDto } from './icp.service';
import { ICPProfileResponseDto, ICPStatsResponseDto } from './dto/icp-response.dto';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { ApiResponseDto } from '../common/dto/api-response.dto';

@ApiTags('icp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('icp')
export class ICPController {
  constructor(private readonly icpService: ICPService) {}

  @Post()
  @ApiOperation({
    summary: 'Create an ICP profile',
    description: 'Creates a new Ideal Customer Profile used to score and filter leads.',
  })
  @ApiResponse({ status: 201, description: 'ICP profile created.', type: ApiResponseDto<ICPProfileResponseDto> })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async create(
    @Tenant() tenant: TenantContext,
    @Body() dto: CreateICPDto,
  ): Promise<ApiResponseDto<ICPProfileResponseDto>> {
    const data = await this.icpService.create(tenant, dto);
    return ApiResponseDto.success(data as ICPProfileResponseDto, 'ICP profile created');
  }

  @Get()
  @ApiOperation({
    summary: 'List all ICP profiles',
    description: 'Returns all ICP profiles for the tenant, ordered by creation date descending.',
  })
  @ApiResponse({ status: 200, description: 'ICP profile list returned.', type: ApiResponseDto<ICPProfileResponseDto[]> })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async findAll(
    @Tenant() tenant: TenantContext,
  ): Promise<ApiResponseDto<ICPProfileResponseDto[]>> {
    const data = await this.icpService.findAll(tenant);
    return ApiResponseDto.success(data as ICPProfileResponseDto[]);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an ICP profile by ID' })
  @ApiParam({ name: 'id', description: 'ICP profile UUID' })
  @ApiResponse({ status: 200, description: 'ICP profile returned.', type: ApiResponseDto<ICPProfileResponseDto> })
  @ApiResponse({ status: 404, description: 'ICP profile not found.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async findOne(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<ICPProfileResponseDto>> {
    const data = await this.icpService.findOne(tenant, id);
    return ApiResponseDto.success(data as ICPProfileResponseDto);
  }

  @Get(':id/stats')
  @ApiOperation({
    summary: 'Get ICP profile stats',
    description: 'Returns conversion metrics and learned signal weights for a specific ICP profile version.',
  })
  @ApiParam({ name: 'id', description: 'ICP profile UUID' })
  @ApiResponse({ status: 200, description: 'ICP stats returned.', type: ApiResponseDto<ICPStatsResponseDto> })
  @ApiResponse({ status: 404, description: 'ICP profile not found.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async getStats(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<ICPStatsResponseDto>> {
    const data = await this.icpService.getStats(tenant, id);
    return ApiResponseDto.success(data as ICPStatsResponseDto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an ICP profile',
    description: 'Partially updates the ICP profile. Updating config bumps the version counter.',
  })
  @ApiParam({ name: 'id', description: 'ICP profile UUID' })
  @ApiResponse({ status: 200, description: 'ICP profile updated.', type: ApiResponseDto<ICPProfileResponseDto> })
  @ApiResponse({ status: 404, description: 'ICP profile not found.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  async update(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateICPDto,
  ): Promise<ApiResponseDto<ICPProfileResponseDto>> {
    const data = await this.icpService.update(tenant, id, dto);
    return ApiResponseDto.success(data as ICPProfileResponseDto, 'ICP profile updated');
  }
}
