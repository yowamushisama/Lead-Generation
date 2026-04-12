import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { PrismaService } from '../database/prisma.service';
import { DataRetentionService } from './data-retention.service';

const mockPrisma = {
  lead: {
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  },
  message: { updateMany: jest.fn() },
  $transaction: jest.fn(),
};

const mockDataRetention = {};

const tenant = { organizationId: 'org-1', userId: 'user-1', role: 'admin' };

const leadRow = {
  id: 'lead-1',
  organizationId: 'org-1',
  name: 'Jane Doe',
  email: 'jane@acme.com',
  role: 'CEO',
  company: 'Acme',
  source: 'linkedin',
  status: 'NEW',
  score: 55,
  createdAt: new Date(),
  messages: [],
  conversations: [],
};

describe('ComplianceService', () => {
  let service: ComplianceService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DataRetentionService, useValue: mockDataRetention },
      ],
    }).compile();

    service = module.get<ComplianceService>(ComplianceService);
  });

  // ── processOptOut ──────────────────────────────────────────────────────────

  describe('processOptOut', () => {
    it('marks lead opted-out and cancels in-flight messages', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(leadRow);
      mockPrisma.$transaction.mockImplementation(async (fn: Function) => {
        const tx = {
          lead: { update: jest.fn().mockResolvedValue({ ...leadRow, optedOut: true }) },
          message: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
        };
        return fn(tx);
      });

      await expect(service.processOptOut(tenant as any, 'lead-1')).resolves.toBeUndefined();
    });

    it('throws NotFoundException for unknown lead', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(null);

      await expect(service.processOptOut(tenant as any, 'ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ── exportLeadData ─────────────────────────────────────────────────────────

  describe('exportLeadData', () => {
    it('returns export with messages and conversations', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(leadRow);

      const result = await service.exportLeadData(tenant as any, 'lead-1');

      expect(result.exportedAt).toBeDefined();
      expect(result.lead.id).toBe('lead-1');
      expect(result.lead.messages).toEqual([]);
      expect(result.lead.conversations).toEqual([]);
    });

    it('throws NotFoundException for unknown lead', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(null);

      await expect(service.exportLeadData(tenant as any, 'ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ── deleteLeadData ─────────────────────────────────────────────────────────

  describe('deleteLeadData', () => {
    it('deletes lead record (cascade handles messages/conversations)', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(leadRow);
      mockPrisma.lead.delete.mockResolvedValue(leadRow);

      await expect(service.deleteLeadData(tenant as any, 'lead-1')).resolves.toBeUndefined();
      expect(mockPrisma.lead.delete).toHaveBeenCalledWith({ where: { id: 'lead-1' } });
    });

    it('throws NotFoundException for unknown lead', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(null);

      await expect(service.deleteLeadData(tenant as any, 'ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getRetentionSummary ────────────────────────────────────────────────────

  describe('getRetentionSummary', () => {
    it('returns correct counts and policy days', async () => {
      mockPrisma.lead.count
        .mockResolvedValueOnce(3)    // expiringSoon
        .mockResolvedValueOnce(5)    // optedOut
        .mockResolvedValueOnce(200); // total

      const result = await service.getRetentionSummary(tenant as any);

      expect(result.totalLeads).toBe(200);
      expect(result.optedOut).toBe(5);
      expect(result.expiringSoon).toBe(3);
      expect(typeof result.retentionPolicyDays).toBe('number');
      // Confirm the old 'expired' field does not exist on the returned object
      expect((result as any).expired).toBeUndefined();
    });
  });
});
