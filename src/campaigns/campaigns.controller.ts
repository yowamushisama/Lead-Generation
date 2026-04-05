import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CampaignFilterDto } from './dto/campaign-filter.dto';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@ApiTags('campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('api/v1/campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a campaign' })
  create(@Tenant() tenant: TenantContext, @Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(tenant, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List campaigns' })
  findAll(@Tenant() tenant: TenantContext, @Query() filters: CampaignFilterDto) {
    return this.campaignsService.findAll(tenant, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a campaign by ID' })
  findOne(@Tenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.campaignsService.findOne(tenant, id);
  }

  @Get(':id/performance')
  @ApiOperation({ summary: 'Get campaign performance metrics' })
  getPerformance(@Tenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.campaignsService.getPerformance(tenant, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a campaign' })
  update(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateCampaignDto>,
  ) {
    return this.campaignsService.update(tenant, id, dto);
  }

  @Patch(':id/pause')
  @ApiOperation({ summary: 'Pause a campaign' })
  pause(@Tenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.campaignsService.pause(tenant, id);
  }

  @Patch(':id/resume')
  @ApiOperation({ summary: 'Resume a campaign' })
  resume(@Tenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.campaignsService.resume(tenant, id);
  }
}
