import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

const tenant = { organizationId: 'org-1', userId: 'user-1', role: 'admin' };

const campaign = {
  id: 'camp-1',
  organizationId: 'org-1',
  name: 'Q2 Outreach',
  description: null,
  icpProfileId: null,
  status: 'ACTIVE',
  isActive: true,
  settings: null,
  leadsGenerated: 5,
  messagesSent: 12,
  replies: 2,
  conversions: 1,
  meetings: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const performance = {
  campaignId: 'camp-1',
  leadsByStatus: { NEW: 3, REPLIED: 2 },
  messagesByStatus: { SENT: 10, DRAFT: 2 },
  metrics: { totalLeads: 5, messagesSent: 10, replyRate: 0.2, conversionRate: 0.1 },
};

const mockCampaignsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  getPerformance: jest.fn(),
  update: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
};

describe('CampaignsController', () => {
  let controller: CampaignsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CampaignsController],
      providers: [{ provide: CampaignsService, useValue: mockCampaignsService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CampaignsController>(CampaignsController);
  });

  describe('create', () => {
    it('returns created campaign with metrics', async () => {
      mockCampaignsService.create.mockResolvedValue(campaign);

      const res = await controller.create(tenant as any, { name: 'Q2 Outreach' } as any);

      expect(res.success).toBe(true);
      expect((res.data as any).leadsGenerated).toBe(5);
    });
  });

  describe('findAll', () => {
    it('returns list of campaigns', async () => {
      mockCampaignsService.findAll.mockResolvedValue([campaign]);

      const res = await controller.findAll(tenant as any, {});

      expect(res.success).toBe(true);
      expect(Array.isArray(res.data)).toBe(true);
      expect((res.data as any[])[0].id).toBe('camp-1');
    });
  });

  describe('findOne', () => {
    it('returns a single campaign', async () => {
      mockCampaignsService.findOne.mockResolvedValue(campaign);

      const res = await controller.findOne(tenant as any, 'camp-1');

      expect(res.success).toBe(true);
      expect((res.data as any).id).toBe('camp-1');
    });

    it('propagates NotFoundException', async () => {
      mockCampaignsService.findOne.mockRejectedValue(new NotFoundException('Campaign not found'));

      await expect(controller.findOne(tenant as any, 'ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPerformance', () => {
    it('returns campaign performance metrics', async () => {
      mockCampaignsService.getPerformance.mockResolvedValue(performance);

      const res = await controller.getPerformance(tenant as any, 'camp-1');

      expect(res.success).toBe(true);
      expect((res.data as any).metrics.replyRate).toBe(0.2);
    });
  });

  describe('update', () => {
    it('returns updated campaign with metrics', async () => {
      mockCampaignsService.update.mockResolvedValue({ ...campaign, name: 'Renamed' });

      const res = await controller.update(tenant as any, 'camp-1', { name: 'Renamed' });

      expect((res.data as any).name).toBe('Renamed');
    });
  });

  describe('pause', () => {
    it('returns paused campaign', async () => {
      mockCampaignsService.pause.mockResolvedValue({ ...campaign, status: 'PAUSED', isActive: false });

      const res = await controller.pause(tenant as any, 'camp-1');

      expect((res.data as any).status).toBe('PAUSED');
      expect((res.data as any).isActive).toBe(false);
    });
  });

  describe('resume', () => {
    it('returns resumed campaign', async () => {
      mockCampaignsService.resume.mockResolvedValue({ ...campaign, status: 'ACTIVE', isActive: true });

      const res = await controller.resume(tenant as any, 'camp-1');

      expect((res.data as any).status).toBe('ACTIVE');
      expect((res.data as any).isActive).toBe(true);
    });
  });
});
