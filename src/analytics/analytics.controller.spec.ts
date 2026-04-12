import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

const tenant = { organizationId: 'org-1', userId: 'user-1', role: 'admin' };

const dashboard = {
  period: '30 days',
  leads: { total: 340, hot: 48, warm: 150, cold: 142, byStatus: {}, byTier: {} },
  outreach: { messagesSent: 280, replyRate: 0.15, conversionRate: 0.053, byStatus: {} },
  usage: { aiTokensUsed: '12345', aiCostCents: 49, leadsProcessed: 340, scrapesExecuted: 3, apiCallsMade: 180 },
};

const funnel = [
  { stage: 'NEW', count: 200, dropOff: 0 },
  { stage: 'REPLIED', count: 80, dropOff: 60 },
  { stage: 'CONVERTED', count: 20, dropOff: 75 },
];

const sources = [
  { source: 'linkedin', count: 200, percentage: 59 },
  { source: 'csv', count: 140, percentage: 41 },
];

const trend = [
  { date: new Date('2026-04-01'), leadsProcessed: 12, aiTokensUsed: BigInt(1000) },
  { date: new Date('2026-04-02'), leadsProcessed: 8, aiTokensUsed: BigInt(800) },
];

const mockAnalyticsService = {
  getDashboard: jest.fn(),
  getFunnel: jest.fn(),
  getLeadSourceBreakdown: jest.fn(),
  getDailyTrend: jest.fn(),
};

describe('AnalyticsController', () => {
  let controller: AnalyticsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [{ provide: AnalyticsService, useValue: mockAnalyticsService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
  });

  describe('getDashboard', () => {
    it('returns wrapped dashboard data', async () => {
      mockAnalyticsService.getDashboard.mockResolvedValue(dashboard);

      const res = await controller.getDashboard(tenant as any);

      expect(res.success).toBe(true);
      expect((res.data as any).period).toBe('30 days');
      expect((res.data as any).leads.total).toBe(340);
    });
  });

  describe('getFunnel', () => {
    it('returns wrapped funnel stages', async () => {
      mockAnalyticsService.getFunnel.mockResolvedValue(funnel);

      const res = await controller.getFunnel(tenant as any);

      expect(res.success).toBe(true);
      expect(Array.isArray(res.data)).toBe(true);
      expect((res.data as any[])[0].stage).toBe('NEW');
    });
  });

  describe('getSources', () => {
    it('returns wrapped source breakdown', async () => {
      mockAnalyticsService.getLeadSourceBreakdown.mockResolvedValue(sources);

      const res = await controller.getSources(tenant as any);

      expect(res.success).toBe(true);
      expect((res.data as any[])[0].source).toBe('linkedin');
    });
  });

  describe('getTrend', () => {
    it('serialises BigInt aiTokensUsed to string', async () => {
      mockAnalyticsService.getDailyTrend.mockResolvedValue(trend);

      const res = await controller.getTrend(tenant as any);

      expect(res.success).toBe(true);
      expect(typeof (res.data as any[])[0].aiTokensUsed).toBe('string');
      expect((res.data as any[])[0].aiTokensUsed).toBe('1000');
    });

    it('defaults to 14-day lookback when no days param given', async () => {
      mockAnalyticsService.getDailyTrend.mockResolvedValue([]);

      await controller.getTrend(tenant as any);

      expect(mockAnalyticsService.getDailyTrend).toHaveBeenCalledWith(tenant, 14);
    });

    it('uses the provided days param', async () => {
      mockAnalyticsService.getDailyTrend.mockResolvedValue([]);

      await controller.getTrend(tenant as any, '7');

      expect(mockAnalyticsService.getDailyTrend).toHaveBeenCalledWith(tenant, 7);
    });
  });
});
