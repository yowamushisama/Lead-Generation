import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ICPController } from './icp.controller';
import { ICPService } from './icp.service';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

const tenant = { organizationId: 'org-1', userId: 'user-1', role: 'admin' };

const icpProfile = {
  id: 'icp-1',
  organizationId: 'org-1',
  name: 'B2B SaaS',
  version: 1,
  isActive: true,
  config: { targetRoles: ['CEO'], targetIndustries: ['SaaS'], targetStages: ['Series-A'], buyerSignals: [], urgencySignals: [], budgetSignals: [] },
  learnedWeights: null,
  conversionRate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const statsResult = {
  profile: icpProfile,
  stats: { totalLeads: 100, convertedLeads: 9, conversionRate: 0.09, version: 1, learnedWeightsCount: 0 },
};

const mockIcpService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  getStats: jest.fn(),
  update: jest.fn(),
};

describe('ICPController', () => {
  let controller: ICPController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ICPController],
      providers: [{ provide: ICPService, useValue: mockIcpService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ICPController>(ICPController);
  });

  describe('create', () => {
    it('returns created ICP profile', async () => {
      mockIcpService.create.mockResolvedValue(icpProfile);

      const res = await controller.create(tenant as any, {
        name: 'B2B SaaS',
        config: { targetRoles: ['CEO'], targetIndustries: ['SaaS'], targetStages: ['Series-A'], buyerSignals: [], urgencySignals: [], budgetSignals: [] },
      });

      expect(res.success).toBe(true);
      expect((res.data as any).id).toBe('icp-1');
    });
  });

  describe('findAll', () => {
    it('returns list of ICP profiles', async () => {
      mockIcpService.findAll.mockResolvedValue([icpProfile]);

      const res = await controller.findAll(tenant as any);

      expect(res.success).toBe(true);
      expect(Array.isArray(res.data)).toBe(true);
    });
  });

  describe('findOne', () => {
    it('returns a single ICP profile', async () => {
      mockIcpService.findOne.mockResolvedValue(icpProfile);

      const res = await controller.findOne(tenant as any, 'icp-1');

      expect((res.data as any).name).toBe('B2B SaaS');
    });

    it('propagates NotFoundException', async () => {
      mockIcpService.findOne.mockRejectedValue(new NotFoundException('Not found'));

      await expect(controller.findOne(tenant as any, 'ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStats', () => {
    it('returns ICP stats including conversion rate', async () => {
      mockIcpService.getStats.mockResolvedValue(statsResult);

      const res = await controller.getStats(tenant as any, 'icp-1');

      expect(res.success).toBe(true);
      expect((res.data as any).stats.conversionRate).toBe(0.09);
    });
  });

  describe('update', () => {
    it('returns updated ICP profile', async () => {
      const updated = { ...icpProfile, version: 2 };
      mockIcpService.update.mockResolvedValue(updated);

      const res = await controller.update(tenant as any, 'icp-1', { name: 'Renamed' });

      expect((res.data as any).version).toBe(2);
    });
  });
});
