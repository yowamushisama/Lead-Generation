import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { LinkedInRunRepository } from '../database/repositories/linkedin-run.repository';

interface RunRow {
  healthy: boolean;
  extractionRate: number;
  rateLimitRate: number;
  healthReason: string | null;
}

interface RunsRollup {
  totalRuns: number;
  healthyRuns: number;
  avgExtractionRate: number;
  avgRateLimitRate: number;
  driftRuns: number;
  rateLimitRuns: number;
  lastHealthReason: string | null;
  runs: RunRow[];
}

@UseGuards(JwtAuthGuard)
@Controller('admin/linkedin-runs')
export class LinkedInRunsController {
  constructor(private readonly linkedInRunRepo: LinkedInRunRepository) {}

  @Get()
  async getRuns(
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
    @Query('orgId') orgId?: string,
  ): Promise<RunsRollup> {
    const runs = (await this.linkedInRunRepo.findRecent(days, orgId)) as RunRow[];

    if (runs.length === 0) {
      return {
        totalRuns: 0,
        healthyRuns: 0,
        avgExtractionRate: 0,
        avgRateLimitRate: 0,
        driftRuns: 0,
        rateLimitRuns: 0,
        lastHealthReason: null,
        runs: [],
      };
    }

    const healthyRuns = runs.filter((r: RunRow) => r.healthy).length;
    const avgExtractionRate =
      runs.reduce((s: number, r: RunRow) => s + r.extractionRate, 0) / runs.length;
    const avgRateLimitRate =
      runs.reduce((s: number, r: RunRow) => s + r.rateLimitRate, 0) / runs.length;
    const driftRuns = runs.filter(
      (r: RunRow) => !r.healthy && r.healthReason?.includes('drift'),
    ).length;
    const rateLimitRuns = runs.filter(
      (r: RunRow) => !r.healthy && r.healthReason?.includes('rate-limit'),
    ).length;
    const lastUnhealthy = runs.find((r: RunRow) => !r.healthy);

    return {
      totalRuns: runs.length,
      healthyRuns,
      avgExtractionRate: Math.round(avgExtractionRate * 1000) / 1000,
      avgRateLimitRate: Math.round(avgRateLimitRate * 1000) / 1000,
      driftRuns,
      rateLimitRuns,
      lastHealthReason: lastUnhealthy?.healthReason ?? null,
      runs,
    };
  }
}
