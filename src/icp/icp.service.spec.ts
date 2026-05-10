import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ICPService } from './icp.service';
import { IcpProfileRepository } from '../database/repositories/icp-profile.repository';
import { IcpProfileChangeLogRepository } from '../database/repositories/icp-profile-change-log.repository';
import { LeadRepository } from '../database/repositories/lead.repository';
import { PrismaService } from '../database/prisma.service';
import { AIProviderFactory } from '../ai/ai-provider.factory';

const mockIcpProfileRepository = {
  create: jest.fn(),
  findMany: jest.fn(),
  findFirst: jest.fn(),
  update: jest.fn(),
};

const mockLeadRepository = {
  count: jest.fn(),
};

const mockChangeLogRepository = {
  createMany: jest.fn().mockResolvedValue(undefined),
};

// $transaction calls the callback synchronously with a fake tx object that
// has iCPProfile.update so the service can use tx.iCPProfile.update inside it.
const mockTx = {
  iCPProfile: { update: jest.fn() },
  iCPProfileChangeLog: { createMany: jest.fn() },
};
const mockPrisma = {
  $transaction: jest.fn().mockImplementation((fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
};

const mockAiFactory = {
  getProvider: jest.fn(),
};

const tenant = { organizationId: 'org-1', userId: 'user-1', role: 'admin' };

const config = {
  targetRoles: ['CEO', 'CTO'],
  targetIndustries: ['SaaS'],
  targetStages: ['Series-A'],
  targetLocations: ['US'],
  buyerSignals: ['hiring'],
  urgencySignals: ['fundraising'],
  budgetSignals: ['Series-A'],
};

const profileRow = {
  id: 'icp-1',
  organizationId: 'org-1',
  name: 'B2B SaaS',
  version: 1,
  config,
  targetRoles: config.targetRoles,
  targetIndustries: config.targetIndustries,
  targetStages: config.targetStages,
  targetLocations: config.targetLocations,
  buyerSignals: config.buyerSignals,
  urgencySignals: config.urgencySignals,
  budgetSignals: config.budgetSignals,
  learnedWeights: null,
  conversionRate: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ICPService', () => {
  let service: ICPService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset the transaction mock's inner tx methods between tests.
    mockTx.iCPProfile.update.mockResolvedValue(profileRow);
    mockTx.iCPProfileChangeLog.createMany.mockResolvedValue({ count: 0 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ICPService,
        { provide: IcpProfileRepository, useValue: mockIcpProfileRepository },
        { provide: IcpProfileChangeLogRepository, useValue: mockChangeLogRepository },
        { provide: LeadRepository, useValue: mockLeadRepository },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AIProviderFactory, useValue: mockAiFactory },
      ],
    }).compile();

    service = module.get<ICPService>(ICPService);
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates and returns a new ICP profile', async () => {
      mockIcpProfileRepository.create.mockResolvedValue(profileRow);

      const result = await service.create(tenant as any, { name: 'B2B SaaS', config });

      expect(result.id).toBe('icp-1');
      expect(mockIcpProfileRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: 'org-1', name: 'B2B SaaS' }),
        }),
      );
    });
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all profiles for the tenant', async () => {
      mockIcpProfileRepository.findMany.mockResolvedValue([profileRow]);

      const result = await service.findAll(tenant as any);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('B2B SaaS');
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns the profile when found', async () => {
      mockIcpProfileRepository.findFirst.mockResolvedValue(profileRow);

      const result = await service.findOne(tenant as any, 'icp-1');

      expect(result.id).toBe('icp-1');
    });

    it('throws NotFoundException when profile does not exist', async () => {
      mockIcpProfileRepository.findFirst.mockResolvedValue(null);

      await expect(service.findOne(tenant as any, 'ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates name without bumping version', async () => {
      mockIcpProfileRepository.findFirst.mockResolvedValue(profileRow);
      mockTx.iCPProfile.update.mockResolvedValue({ ...profileRow, name: 'Renamed' });

      const result = await service.update(tenant as any, 'icp-1', { name: 'Renamed' });

      expect(mockTx.iCPProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Renamed' }) }),
      );
      expect(result.name).toBe('Renamed');
    });

    it('bumps version when config is updated', async () => {
      mockIcpProfileRepository.findFirst.mockResolvedValue(profileRow);
      mockTx.iCPProfile.update.mockResolvedValue({ ...profileRow, version: 2 });

      await service.update(tenant as any, 'icp-1', { config: { ...config, targetRoles: ['CMO'] } });

      expect(mockTx.iCPProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ version: { increment: 1 } }),
        }),
      );
    });

    it('writes a config change log entry when config blob changes', async () => {
      // When profileRow has a non-empty top-level targetIndustries column, resolveICPField
      // returns that value (top-level wins), so only the raw 'config' blob diff is recorded.
      mockIcpProfileRepository.findFirst.mockResolvedValue(profileRow);
      mockTx.iCPProfile.update.mockResolvedValue({ ...profileRow, version: 2 });

      await service.update(tenant as any, 'icp-1', {
        config: { ...config, targetIndustries: ['FinTech'] },
      });

      expect(mockChangeLogRepository.createMany).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({ fieldName: 'config' }),
        ]),
      );
    });

    it('writes a targetIndustries change log entry when top-level column has no prior value', async () => {
      // When the top-level column is empty, resolveICPField falls back to config.*,
      // so a change to config.targetIndustries IS captured as a targeted fieldName diff.
      const profileWithoutTopLevel = {
        ...profileRow,
        targetIndustries: [],
        targetLocations: [],
        buyerSignals: [],
        urgencySignals: [],
      };
      mockIcpProfileRepository.findFirst.mockResolvedValue(profileWithoutTopLevel);
      mockTx.iCPProfile.update.mockResolvedValue({ ...profileWithoutTopLevel, version: 2 });

      await service.update(tenant as any, 'icp-1', {
        config: { ...config, targetIndustries: ['FinTech'] },
      });

      expect(mockChangeLogRepository.createMany).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({ fieldName: 'targetIndustries' }),
        ]),
      );
    });

    it('does not write change log when only name changes', async () => {
      mockIcpProfileRepository.findFirst.mockResolvedValue(profileRow);
      mockTx.iCPProfile.update.mockResolvedValue({ ...profileRow, name: 'New Name' });
      mockChangeLogRepository.createMany.mockClear();

      await service.update(tenant as any, 'icp-1', { name: 'New Name' });

      expect(mockChangeLogRepository.createMany).not.toHaveBeenCalled();
    });
  });

  // ── getStats ───────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns profile and conversion stats', async () => {
      mockIcpProfileRepository.findFirst.mockResolvedValue(profileRow);
      mockLeadRepository.count
        .mockResolvedValueOnce(100)  // total
        .mockResolvedValueOnce(9);   // converted

      const result = await service.getStats(tenant as any, 'icp-1');

      expect(result.profile.id).toBe('icp-1');
      expect(result.stats.conversionRate).toBeCloseTo(0.09);
      expect(result.stats.learnedWeightsCount).toBe(0);
    });

    it('returns 0 conversion rate when no leads exist', async () => {
      mockIcpProfileRepository.findFirst.mockResolvedValue(profileRow);
      mockLeadRepository.count.mockResolvedValue(0);

      const result = await service.getStats(tenant as any, 'icp-1');

      expect(result.stats.conversionRate).toBe(0);
    });
  });

  // ── matchLead ──────────────────────────────────────────────────────────────

  describe('matchLead', () => {
    it('returns isMatch true when role and industry match ICP', async () => {
      mockIcpProfileRepository.findFirst.mockResolvedValue(profileRow);

      const match = await service.matchLead('org-1', { role: 'CEO', industry: 'SaaS', companyStage: 'Series-A' });

      expect(match.isMatch).toBe(true);
      expect(match.matchScore).toBeGreaterThan(0);
    });

    it('returns isMatch false when no active ICP profile exists', async () => {
      mockIcpProfileRepository.findFirst.mockResolvedValue(null);

      const match = await service.matchLead('org-1', { role: 'CEO' });

      expect(match.isMatch).toBe(false);
      expect(match.reasoning).toContain('No active ICP profile');
    });
  });
});
