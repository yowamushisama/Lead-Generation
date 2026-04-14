import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { PromptConfigService } from './prompt-config.service';
import { CreatePromptConfigDto } from './dto/create-prompt-config.dto';
import { UpdatePromptConfigDto } from './dto/update-prompt-config.dto';
import { PreviewRequestDto } from './dto/preview-request.dto';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { ApiResponseDto } from '../common/dto/api-response.dto';

@ApiTags('prompt-configs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('prompt-configs')
export class PromptConfigController {
  constructor(private readonly promptConfigService: PromptConfigService) {}

  @Get()
  @ApiOperation({ summary: 'List all prompt configs in this organization' })
  @ApiResponse({ status: 200, description: 'List returned' })
  async list(@Tenant() tenant: TenantContext) {
    const data = await this.promptConfigService.list(tenant);
    return ApiResponseDto.success(data, 'Prompt configs retrieved');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new reusable prompt config' })
  @ApiResponse({ status: 201, description: 'Config created' })
  async create(
    @Tenant() tenant: TenantContext,
    @Body() dto: CreatePromptConfigDto,
  ) {
    const data = await this.promptConfigService.create(tenant, dto);
    return ApiResponseDto.success(data, 'Prompt config created');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a prompt config by ID' })
  @ApiParam({ name: 'id', description: 'PromptConfig UUID' })
  @ApiResponse({ status: 200, description: 'Config returned' })
  async findById(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.promptConfigService.findById(tenant, id);
    return ApiResponseDto.success(data, 'Prompt config retrieved');
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a prompt config (auto-versions)' })
  @ApiParam({ name: 'id', description: 'PromptConfig UUID' })
  @ApiResponse({ status: 200, description: 'Config updated' })
  async update(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePromptConfigDto,
  ) {
    const data = await this.promptConfigService.update(tenant, id, dto);
    return ApiResponseDto.success(data, 'Prompt config updated');
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a prompt config' })
  @ApiParam({ name: 'id', description: 'PromptConfig UUID' })
  async archive(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.promptConfigService.archive(tenant, id);
    return ApiResponseDto.success(data, 'Prompt config archived');
  }

  @Post(':id/clone')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Clone a prompt config' })
  @ApiParam({ name: 'id', description: 'PromptConfig UUID' })
  async clone(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.promptConfigService.clone(tenant, id);
    return ApiResponseDto.success(data, 'Prompt config cloned');
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get version history for a prompt config' })
  @ApiParam({ name: 'id', description: 'PromptConfig UUID' })
  async getHistory(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.promptConfigService.getHistory(tenant, id);
    return ApiResponseDto.success(data);
  }

  @Post(':id/restore/:version')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore a previous version of a prompt config' })
  @ApiParam({ name: 'id', description: 'PromptConfig UUID' })
  @ApiParam({ name: 'version', description: 'Version number to restore', type: Number })
  async restoreVersion(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    const data = await this.promptConfigService.restoreVersion(tenant, id, version);
    return ApiResponseDto.success(data, `Restored to version ${version}`);
  }

  @Post(':id/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a preview message using this prompt config' })
  @ApiParam({ name: 'id', description: 'PromptConfig UUID' })
  async preview(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PreviewRequestDto,
  ) {
    const data = await this.promptConfigService.preview(tenant, id, dto);
    return ApiResponseDto.success(data, 'Preview generated');
  }
}
