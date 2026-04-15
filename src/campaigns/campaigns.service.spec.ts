import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignRunnerService } from './campaign-runner.service';
import { CampaignRepository } from '../database/repositories/campaign.repository';
import { LeadRepository } from '../database/repositories/lead.repository';
import { MessageRepository } from '../database/repositories/message.repository';
import { IcpProfileRepository } from '../database/repositories/icp-profile.repository';
import { PrismaService } from '../database/prisma.service';

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

const icpRow = {
  id: 'icp-1',
  organizationId: 'org-1',
  name: 'Default ICP',
  buyerSignals: ['AI', 'automation'],
  urgencySignals: ['hiring', 'fundraising'],
  targetLocations: ['United States'],
  targetIndustries: ['SaaS'],
  config: null,
};

const mockIcpProfileRepository = {
  findFirst: jest.fn(),
};

const mockPrismaService = {};

const mockCampaignRunnerService = {
  runOnActivationIfEnabled: jest.fn(),
};

const tenant = { organizationId: 'org-1', userId: 'user-1', role: 'admin' };

const campaignRow = {
  id: 'camp-1',
  organizationId: 'org-1',
  name: 'Q2',
  description: null,
  icpProfileId: 'icp-1',
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
    mockIcpProfileRepository.findFirst.mockResolvedValue(icpRow);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: CampaignRepository, useValue: mockCampaignRepository },
        { provide: LeadRepository, useValue: mockLeadRepository },
        { provide: MessageRepository, useValue: mockMessageRepository },
        { provide: IcpProfileRepository, useValue: mockIcpProfileRepository },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CampaignRunnerService, useValue: mockCampaignRunnerService },
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
      mockIcpProfileRepository.findFirst.mockResolvedValue(icpRow);
      mockCampaignRepository.create.mockResolvedValue({ ...campaignRow });
      setupFindOneSuccess();

      const result = await service.create(tenant as any, { name: 'Q2', icpProfileId: 'icp-1' } as any);

      expect(result.leadsGenerated).toBe(5);
      expect(result.messagesSent).toBe(12);
      expect(result.replies).toBe(2);
      expect(mockIcpProfileRepository.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'icp-1', organizationId: 'org-1' } }),
      );
    });

    it('throws NotFoundException when ICP profile does not exist', async () => {
      mockIcpProfileRepository.findFirst.mockResolvedValue(null);

      await expect(
        service.create(tenant as any, { name: 'Q2', icpProfileId: 'missing-icp' } as any),
      ).rejects.toThrow(NotFoundException);
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

  // ── launch ─────────────────────────────────────────────────────────────────

  describe('launch', () => {
    it('transitions DRAFT to ACTIVE and returns updated campaign', async () => {
      const draft  = { ...campaignRow, status: 'DRAFT', isActive: false, _count: { leads: 0, messages: 0 } };
      const active = { ...campaignRow, status: 'ACTIVE', isActive: true, _count: { leads: 0, messages: 0 } };
      mockCampaignRepository.findFirst
        .mockResolvedValueOnce(draft)   // guard findOne
        .mockResolvedValueOnce(active); // re-fetch after update
      mockCampaignRepository.update.mockResolvedValue(active);
      mockLeadRepository.countByCampaignAndStatus.mockResolvedValue([]);

      const result = await service.launch(tenant as any, 'camp-1');

      expect(result.status).toBe('ACTIVE');
      expect(result.isActive).toBe(true);
      expect(mockCampaignRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'ACTIVE', isActive: true } }),
      );
      expect(mockCampaignRunnerService.runOnActivationIfEnabled).toHaveBeenCalledWith(
        tenant,
        'camp-1',
      );
    });

    it('throws ForbiddenException when launching a non-DRAFT campaign', async () => {
      mockCampaignRepository.findFirst.mockResolvedValueOnce(campaignRow); // status ACTIVE
      mockLeadRepository.countByCampaignAndStatus.mockResolvedValue([]);

      await expect(service.launch(tenant as any, 'camp-1')).rejects.toThrow(ForbiddenException);
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
      const paused = { ...campaignRow, status: 'PAUSED', isActive: false, _count: { leads: 5, messages: 12 } };
      const active = { ...campaignRow, status: 'ACTIVE', isActive: true, _count: { leads: 5, messages: 12 } };
      mockCampaignRepository.findFirst
        .mockResolvedValueOnce(paused)   // first findOne (guard check)
        .mockResolvedValueOnce(active);  // re-fetch after update
      mockCampaignRepository.update.mockResolvedValue(active);
      mockLeadRepository.countByCampaignAndStatus.mockResolvedValue([]);

      const result = await service.resume(tenant as any, 'camp-1');

      expect(result.status).toBe('ACTIVE');
      expect(result.isActive).toBe(true);
      expect(mockCampaignRunnerService.runOnActivationIfEnabled).toHaveBeenCalledWith(
        tenant,
        'camp-1',
      );
    });

    it('throws ForbiddenException when resuming an archived campaign', async () => {
      const archived = { ...campaignRow, status: 'ARCHIVED', isActive: false, _count: { leads: 0, messages: 0 } };
      mockCampaignRepository.findFirst.mockResolvedValueOnce(archived);
      mockLeadRepository.countByCampaignAndStatus.mockResolvedValue([]);

      await expect(service.resume(tenant as any, 'camp-1')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── archive enforcement ────────────────────────────────────────────────────

  describe('update', () => {
    it('throws ForbiddenException when updating an archived campaign', async () => {
      const archived = { ...campaignRow, status: 'ARCHIVED', isActive: false, _count: { leads: 0, messages: 0 } };
      mockCampaignRepository.findFirst.mockResolvedValueOnce(archived);
      mockLeadRepository.countByCampaignAndStatus.mockResolvedValue([]);

      await expect(
        service.update(tenant as any, 'camp-1', { name: 'New Name' }),
      ).rejects.toThrow(ForbiddenException);
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
