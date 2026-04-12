import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { LeadRepository } from '../database/repositories/lead.repository';
import { MessageRepository } from '../database/repositories/message.repository';
import { PrismaTransactionService } from '../database/repositories/prisma-transaction.service';
import { DataRetentionService } from './data-retention.service';

const mockLeadRepository = {
  findFirst: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
  delete: jest.fn(),
};

const mockMessageRepository = {
  updateMany: jest.fn(),
};

const mockTransaction = {
  run: jest.fn(),
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
        { provide: LeadRepository, useValue: mockLeadRepository },
        { provide: MessageRepository, useValue: mockMessageRepository },
        { provide: PrismaTransactionService, useValue: mockTransaction },
        { provide: DataRetentionService, useValue: mockDataRetention },
      ],
    }).compile();

    service = module.get<ComplianceService>(ComplianceService);
  });

  // ── processOptOut ──────────────────────────────────────────────────────────

  describe('processOptOut', () => {
    it('marks lead opted-out and cancels in-flight messages', async () => {
      mockLeadRepository.findFirst.mockResolvedValue(leadRow);
      mockLeadRepository.update.mockResolvedValue({ ...leadRow, optedOut: true });
      mockMessageRepository.updateMany.mockResolvedValue({ count: 2 });
      mockTransaction.run.mockImplementation(async (fn: Function) => fn({}));

      await expect(service.processOptOut(tenant as any, 'lead-1')).resolves.toBeUndefined();
    });

    it('throws NotFoundException for unknown lead', async () => {
      mockLeadRepository.findFirst.mockResolvedValue(null);

      await expect(service.processOptOut(tenant as any, 'ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ── exportLeadData ─────────────────────────────────────────────────────────

  describe('exportLeadData', () => {
    it('returns export with messages and conversations', async () => {
      mockLeadRepository.findFirst.mockResolvedValue(leadRow);

      const result = await service.exportLeadData(tenant as any, 'lead-1');

      expect(result.exportedAt).toBeDefined();
      expect(result.lead.id).toBe('lead-1');
      expect(result.lead.messages).toEqual([]);
      expect(result.lead.conversations).toEqual([]);
    });

    it('throws NotFoundException for unknown lead', async () => {
      mockLeadRepository.findFirst.mockResolvedValue(null);

      await expect(service.exportLeadData(tenant as any, 'ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ── deleteLeadData ─────────────────────────────────────────────────────────

  describe('deleteLeadData', () => {
    it('deletes lead record (cascade handles messages/conversations)', async () => {
      mockLeadRepository.findFirst.mockResolvedValue(leadRow);
      mockLeadRepository.delete.mockResolvedValue(leadRow);

      await expect(service.deleteLeadData(tenant as any, 'lead-1')).resolves.toBeUndefined();
      expect(mockLeadRepository.delete).toHaveBeenCalledWith({ where: { id: 'lead-1' } });
    });

    it('throws NotFoundException for unknown lead', async () => {
      mockLeadRepository.findFirst.mockResolvedValue(null);

      await expect(service.deleteLeadData(tenant as any, 'ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getRetentionSummary ────────────────────────────────────────────────────

  describe('getRetentionSummary', () => {
    it('returns correct counts and policy days', async () => {
      mockLeadRepository.count
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
