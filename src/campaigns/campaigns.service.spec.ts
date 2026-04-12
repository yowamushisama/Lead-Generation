import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignRepository } from '../database/repositories/campaign.repository';
import { LeadRepository } from '../database/repositories/lead.repository';
import { MessageRepository } from '../database/repositories/message.repository';

const mockCampaignRepository = {
  create: jest.fn(),
  findMany: jest.fn(),
  findFirst: jest.fn(),
  update: jest.fn(),
};

const mockLeadRepository = {
  countByStatus: jest.fn(),
  countByCampaignAndStatus: jest.fn(),
};

const mockMessageRepository = {
  countByStatus: jest.fn(),
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
        { provide: CampaignRepository, useValue: mockCampaignRepository },
        { provide: LeadRepository, useValue: mockLeadRepository },
        { provide: MessageRepository, useValue: mockMessageRepository },
      ],
    }).compile();

    service = module.get<CampaignsService>(CampaignsService);
  });

  // ── helpers ────────────────────────────────────────────────────────────────

  function setupFindOneSuccess() {
    mockCampaignRepository.findFirst.mockResolvedValue(campaignRow);
    mockLeadRepository.countByCampaignAndStatus.mockResolvedValue([
      { campaignId: 'camp-1', status: 'REPLIED', _count: { id: 2 } },
      { campaignId: 'camp-1', status: 'CONVERTED', _count: { id: 1 } },
    ]);
  }

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a campaign and returns it with metrics', async () => {
      mockCampaignRepository.create.mockResolvedValue({ ...campaignRow });
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
      mockCampaignRepository.findMany.mockResolvedValue([campaignRow]);
      mockLeadRepository.countByCampaignAndStatus.mockResolvedValue([
        { campaignId: 'camp-1', status: 'REPLIED', _count: { id: 2 } },
        { campaignId: 'camp-1', status: 'CONVERTED', _count: { id: 1 } },
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
      mockCampaignRepository.findMany.mockResolvedValue([]);
      mockLeadRepository.countByCampaignAndStatus.mockResolvedValue([]);

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
      mockCampaignRepository.findFirst.mockResolvedValue(null);

      await expect(service.findOne(tenant as any, 'ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates name and returns refreshed campaign with metrics', async () => {
      setupFindOneSuccess();
      mockCampaignRepository.update.mockResolvedValue({ ...campaignRow, name: 'Renamed' });

      const result = await service.update(tenant as any, 'camp-1', { name: 'Renamed' });

      expect(result.leadsGenerated).toBe(5);
      expect(mockCampaignRepository.update).toHaveBeenCalled();
    });
  });

  // ── pause ──────────────────────────────────────────────────────────────────

  describe('pause', () => {
    it('sets status PAUSED and returns updated campaign', async () => {
      const paused = { ...campaignRow, status: 'PAUSED', isActive: false };
      mockCampaignRepository.findFirst
        .mockResolvedValueOnce(campaignRow)  // guard findOne check
        .mockResolvedValueOnce(paused);      // re-fetch after update
      mockCampaignRepository.update.mockResolvedValue(paused);
      mockLeadRepository.countByCampaignAndStatus.mockResolvedValue([]);

      const result = await service.pause(tenant as any, 'camp-1');

      expect(result.status).toBe('PAUSED');
      expect(result.isActive).toBe(false);
      expect(mockCampaignRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'PAUSED', isActive: false } }),
      );
    });
  });

  // ── resume ─────────────────────────────────────────────────────────────────

  describe('resume', () => {
    it('sets status ACTIVE and returns updated campaign', async () => {
      const active = { ...campaignRow, status: 'ACTIVE', isActive: true };
      mockCampaignRepository.findFirst
        .mockResolvedValueOnce(campaignRow)
        .mockResolvedValueOnce(active);
      mockCampaignRepository.update.mockResolvedValue(active);
      mockLeadRepository.countByCampaignAndStatus.mockResolvedValue([]);

      const result = await service.resume(tenant as any, 'camp-1');

      expect(result.status).toBe('ACTIVE');
      expect(result.isActive).toBe(true);
    });
  });

  // ── getPerformance ─────────────────────────────────────────────────────────

  describe('getPerformance', () => {
    it('computes reply rate and conversion rate', async () => {
      setupFindOneSuccess();
      mockCampaignRepository.findFirst.mockResolvedValue(campaignRow);
      mockLeadRepository.countByCampaignAndStatus.mockResolvedValue([]);
      mockLeadRepository.countByStatus.mockResolvedValue([{ status: 'REPLIED', _count: { id: 5 } }]);
      mockMessageRepository.countByStatus.mockResolvedValue([{ status: 'SENT', _count: { id: 20 } }]);

      const result = await service.getPerformance(tenant as any, 'camp-1');

      expect(result.campaignId).toBe('camp-1');
      expect(result.metrics.replyRate).toBeDefined();
      expect(result.metrics.conversionRate).toBeDefined();
    });
  });
});
