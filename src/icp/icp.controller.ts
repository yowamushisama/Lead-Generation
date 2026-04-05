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
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ICPService, CreateICPDto, UpdateICPDto } from './icp.service';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@ApiTags('icp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('api/v1/icp')
export class ICPController {
  constructor(private readonly icpService: ICPService) {}

  @Post()
  @ApiOperation({ summary: 'Create an ICP profile' })
  create(@Tenant() tenant: TenantContext, @Body() dto: CreateICPDto) {
    return this.icpService.create(tenant, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all ICP profiles' })
  findAll(@Tenant() tenant: TenantContext) {
    return this.icpService.findAll(tenant);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an ICP profile by ID' })
  findOne(@Tenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.icpService.findOne(tenant, id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get ICP profile stats and learned weights' })
  getStats(@Tenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.icpService.getStats(tenant, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an ICP profile' })
  update(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateICPDto,
  ) {
    return this.icpService.update(tenant, id, dto);
  }
}
