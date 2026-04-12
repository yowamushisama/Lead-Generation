import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ICPService } from './icp.service';
import { PrismaService } from '../database/prisma.service';

const mockPrisma = {
  iCPProfile: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  lead: {
    count: jest.fn(),
  },
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ICPService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ICPService>(ICPService);
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates and returns a new ICP profile', async () => {
      mockPrisma.iCPProfile.create.mockResolvedValue(profileRow);

      const result = await service.create(tenant as any, { name: 'B2B SaaS', config });

      expect(result.id).toBe('icp-1');
      expect(mockPrisma.iCPProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: 'org-1', name: 'B2B SaaS' }),
        }),
      );
    });
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all profiles for the tenant', async () => {
      mockPrisma.iCPProfile.findMany.mockResolvedValue([profileRow]);

      const result = await service.findAll(tenant as any);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('B2B SaaS');
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns the profile when found', async () => {
      mockPrisma.iCPProfile.findFirst.mockResolvedValue(profileRow);

      const result = await service.findOne(tenant as any, 'icp-1');

      expect(result.id).toBe('icp-1');
    });

    it('throws NotFoundException when profile does not exist', async () => {
      mockPrisma.iCPProfile.findFirst.mockResolvedValue(null);

      await expect(service.findOne(tenant as any, 'ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates name without bumping version', async () => {
      mockPrisma.iCPProfile.findFirst.mockResolvedValue(profileRow);
      mockPrisma.iCPProfile.update.mockResolvedValue({ ...profileRow, name: 'Renamed' });

      const result = await service.update(tenant as any, 'icp-1', { name: 'Renamed' });

      expect(mockPrisma.iCPProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Renamed' }) }),
      );
      expect(result.name).toBe('Renamed');
    });

    it('bumps version when config is updated', async () => {
      mockPrisma.iCPProfile.findFirst.mockResolvedValue(profileRow);
      mockPrisma.iCPProfile.update.mockResolvedValue({ ...profileRow, version: 2 });

      await service.update(tenant as any, 'icp-1', { config: { ...config, targetRoles: ['CMO'] } });

      expect(mockPrisma.iCPProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ version: { increment: 1 } }),
        }),
      );
    });
  });

  // ── getStats ───────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns profile and conversion stats', async () => {
      mockPrisma.iCPProfile.findFirst.mockResolvedValue(profileRow);
      mockPrisma.lead.count
        .mockResolvedValueOnce(100)  // total
        .mockResolvedValueOnce(9);   // converted

      const result = await service.getStats(tenant as any, 'icp-1');

      expect(result.profile.id).toBe('icp-1');
      expect(result.stats.conversionRate).toBeCloseTo(0.09);
      expect(result.stats.learnedWeightsCount).toBe(0);
    });

    it('returns 0 conversion rate when no leads exist', async () => {
      mockPrisma.iCPProfile.findFirst.mockResolvedValue(profileRow);
      mockPrisma.lead.count.mockResolvedValue(0);

      const result = await service.getStats(tenant as any, 'icp-1');

      expect(result.stats.conversionRate).toBe(0);
    });
  });

  // ── matchLead ──────────────────────────────────────────────────────────────

  describe('matchLead', () => {
    it('returns isMatch true when role and industry match ICP', async () => {
      mockPrisma.iCPProfile.findFirst.mockResolvedValue(profileRow);

      const match = await service.matchLead('org-1', { role: 'CEO', industry: 'SaaS', companyStage: 'Series-A' });

      expect(match.isMatch).toBe(true);
      expect(match.matchScore).toBeGreaterThan(0);
    });

    it('returns isMatch false when no active ICP profile exists', async () => {
      mockPrisma.iCPProfile.findFirst.mockResolvedValue(null);

      const match = await service.matchLead('org-1', { role: 'CEO' });

      expect(match.isMatch).toBe(false);
      expect(match.reasoning).toContain('No active ICP profile');
    });
  });
});
