import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { PrismaService } from '../database/prisma.service';

const mockPrisma = {
  campaign: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  lead: {
    groupBy: jest.fn(),
  },
  message: {
    groupBy: jest.fn(),
  },
};

const tenant = { organizationId: 'org-1', userId: 'user-1', role: 'admin' };

const campaignRow = {
  id: 'camp-1',
  organizationId: 'org-1',
  name: 'Q2',
  description: null,
  icpProfileId: null,
  status: 'ACTIVE',
  isActive: true,
  settings: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { leads: 5, messages: 12 },
};

const campaignWithMetrics = {
  id: 'camp-1',
  organizationId: 'org-1',
  name: 'Q2',
  description: null,
  icpProfileId: null,
  status: 'ACTIVE',
  isActive: true,
  settings: null,
  createdAt: campaignRow.createdAt,
  updatedAt: campaignRow.updatedAt,
  leadsGenerated: 5,
  messagesSent: 12,
  replies: 2,
  conversions: 1,
  meetings: 0,
};

describe('CampaignsService', () => {
  let service: CampaignsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CampaignsService>(CampaignsService);
  });

  // ── helpers ────────────────────────────────────────────────────────────────

  function setupFindOneSuccess() {
    mockPrisma.campaign.findFirst.mockResolvedValue(campaignRow);
    mockPrisma.lead.groupBy.mockResolvedValue([
      { campaignId: 'camp-1', status: 'REPLIED', _count: 2 },
      { campaignId: 'camp-1', status: 'CONVERTED', _count: 1 },
    ]);
  }

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a campaign and returns it with metrics', async () => {
      mockPrisma.campaign.create.mockResolvedValue({ ...campaignRow });
      setupFindOneSuccess();

      const result = await service.create(tenant as any, { name: 'Q2' } as any);

      expect(result.leadsGenerated).toBe(5);
      expect(result.messagesSent).toBe(12);
      expect(result.replies).toBe(2);
    });
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns campaigns with live metrics', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([campaignRow]);
      mockPrisma.lead.groupBy.mockResolvedValue([
        { campaignId: 'camp-1', status: 'REPLIED', _count: 2 },
        { campaignId: 'camp-1', status: 'CONVERTED', _count: 1 },
      ]);

      const result = await service.findAll(tenant as any, {});

      expect(result).toHaveLength(1);
      expect(result[0].leadsGenerated).toBe(5);
      expect(result[0].replies).toBe(2);
      expect(result[0].conversions).toBe(1);
      expect(result[0].meetings).toBe(0);
      // _count must not leak into the response
      expect((result[0] as any)._count).toBeUndefined();
    });

    it('returns empty array when no campaigns exist', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([]);
      mockPrisma.lead.groupBy.mockResolvedValue([]);

      const result = await service.findAll(tenant as any, {});

      expect(result).toEqual([]);
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns the campaign with metrics', async () => {
      setupFindOneSuccess();

      const result = await service.findOne(tenant as any, 'camp-1');

      expect(result.id).toBe('camp-1');
      expect(result.replies).toBe(2);
    });

    it('throws NotFoundException when campaign does not exist', async () => {
      mockPrisma.campaign.findFirst.mockResolvedValue(null);

      await expect(service.findOne(tenant as any, 'ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates name and returns refreshed campaign with metrics', async () => {
      setupFindOneSuccess();
      mockPrisma.campaign.update.mockResolvedValue({ ...campaignRow, name: 'Renamed' });

      const result = await service.update(tenant as any, 'camp-1', { name: 'Renamed' });

      expect(result.leadsGenerated).toBe(5);
      expect(mockPrisma.campaign.update).toHaveBeenCalled();
    });
  });

  // ── pause ──────────────────────────────────────────────────────────────────

  describe('pause', () => {
    it('sets status PAUSED and returns updated campaign', async () => {
      const paused = { ...campaignRow, status: 'PAUSED', isActive: false };
      mockPrisma.campaign.findFirst
        .mockResolvedValueOnce(campaignRow)  // guard findOne check
        .mockResolvedValueOnce(paused);      // re-fetch after update
      mockPrisma.campaign.update.mockResolvedValue(paused);
      mockPrisma.lead.groupBy.mockResolvedValue([]);

      const result = await service.pause(tenant as any, 'camp-1');

      expect(result.status).toBe('PAUSED');
      expect(result.isActive).toBe(false);
      expect(mockPrisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'PAUSED', isActive: false } }),
      );
    });
  });

  // ── resume ─────────────────────────────────────────────────────────────────

  describe('resume', () => {
    it('sets status ACTIVE and returns updated campaign', async () => {
      const active = { ...campaignRow, status: 'ACTIVE', isActive: true };
      mockPrisma.campaign.findFirst
        .mockResolvedValueOnce(campaignRow)
        .mockResolvedValueOnce(active);
      mockPrisma.campaign.update.mockResolvedValue(active);
      mockPrisma.lead.groupBy.mockResolvedValue([]);

      const result = await service.resume(tenant as any, 'camp-1');

      expect(result.status).toBe('ACTIVE');
      expect(result.isActive).toBe(true);
    });
  });

  // ── getPerformance ─────────────────────────────────────────────────────────

  describe('getPerformance', () => {
    it('computes reply rate and conversion rate', async () => {
      setupFindOneSuccess();
      mockPrisma.lead.groupBy
        .mockResolvedValueOnce([{ status: 'REPLIED', _count: 5 }]) // performance leads (first call)
        .mockResolvedValueOnce([]);                                  // attachMetrics leads (second findOne)
      mockPrisma.message.groupBy.mockResolvedValue([{ status: 'SENT', _count: 20 }]);

      // Override: getPerformance calls findOne first, then does two groupBy calls
      mockPrisma.campaign.findFirst.mockResolvedValue(campaignRow);
      mockPrisma.lead.groupBy.mockResolvedValue([{ status: 'REPLIED', _count: 5 }]);
      mockPrisma.message.groupBy.mockResolvedValue([{ status: 'SENT', _count: 20 }]);

      const result = await service.getPerformance(tenant as any, 'camp-1');

      expect(result.campaignId).toBe('camp-1');
      expect(result.metrics.replyRate).toBeDefined();
      expect(result.metrics.conversionRate).toBeDefined();
    });
  });
});
