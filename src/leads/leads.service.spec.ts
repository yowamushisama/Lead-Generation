import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { PrismaService } from '../database/prisma.service';
import { DeduplicationService } from './deduplication.service';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockPrisma = {
  lead: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    groupBy: jest.fn(),
    aggregate: jest.fn(),
  },
};

const mockDedup = {
  checkDuplicate: jest.fn(),
  computeContentHash: jest.fn().mockReturnValue('hash-123'),
};

const tenant = { organizationId: 'org-1', userId: 'user-1', role: 'admin' };

const leadRow = {
  id: 'lead-1',
  organizationId: 'org-1',
  name: 'Jane Doe',
  source: 'linkedin',
  status: 'NEW',
  tier: 'COLD',
  score: 0,
  optedOut: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('LeadsService', () => {
  let service: LeadsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DeduplicationService, useValue: mockDedup },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = { name: 'Jane Doe', source: 'linkedin', email: 'jane@example.com', company: 'Acme' } as any;

    it('creates and returns a new lead', async () => {
      mockDedup.checkDuplicate.mockResolvedValue(false);
      mockPrisma.lead.create.mockResolvedValue(leadRow);

      const result = await service.create(tenant as any, dto);

      expect(result).toEqual(leadRow);
      expect(mockPrisma.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org-1', name: 'Jane Doe', status: 'NEW' }) }),
      );
    });

    it('throws ConflictException for duplicate leads', async () => {
      mockDedup.checkDuplicate.mockResolvedValue(true);

      await expect(service.create(tenant as any, dto)).rejects.toThrow(ConflictException);
      expect(mockPrisma.lead.create).not.toHaveBeenCalled();
    });
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated leads with correct meta', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([leadRow]);
      mockPrisma.lead.count.mockResolvedValue(1);

      const pagination = { page: 1, limit: 20, skip: 0 } as any;
      const result = await service.findAll(tenant as any, {}, pagination);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      expect(result.meta.hasNextPage).toBe(false);
    });

    it('filters by status when provided', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([]);
      mockPrisma.lead.count.mockResolvedValue(0);

      await service.findAll(tenant as any, { status: 'REPLIED' } as any, { page: 1, limit: 20, skip: 0 } as any);

      expect(mockPrisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'REPLIED' }) }),
      );
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns the lead with messages and conversations', async () => {
      const withRelations = { ...leadRow, messages: [], conversations: [] };
      mockPrisma.lead.findFirst.mockResolvedValue(withRelations);

      const result = await service.findOne('org-1', 'lead-1');

      expect(result.id).toBe('lead-1');
      expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: 'lead-1', organizationId: 'org-1' }) }),
      );
    });

    it('throws NotFoundException when lead does not exist', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(null);

      await expect(service.findOne('org-1', 'ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates and returns the lead', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(leadRow);
      mockPrisma.lead.update.mockResolvedValue({ ...leadRow, status: 'REPLIED' });

      const result = await service.update('org-1', 'lead-1', { status: 'REPLIED' } as any);

      expect(result.status).toBe('REPLIED');
    });

    it('throws NotFoundException for unknown lead', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(null);

      await expect(service.update('org-1', 'ghost', {})).rejects.toThrow(NotFoundException);
    });

    it('calls optOut when dto.optedOut is true and lead is not already opted out', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue({ ...leadRow, optedOut: false });
      mockPrisma.lead.update.mockResolvedValue({ ...leadRow, optedOut: true, status: 'OPT_OUT' });

      const result = await service.update('org-1', 'lead-1', { optedOut: true } as any);

      expect(result.status).toBe('OPT_OUT');
    });
  });

  // ── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deletes a lead without returning a value', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(leadRow);
      mockPrisma.lead.delete.mockResolvedValue(leadRow);

      await expect(service.remove('org-1', 'lead-1')).resolves.toBeUndefined();
      expect(mockPrisma.lead.delete).toHaveBeenCalledWith({ where: { id: 'lead-1' } });
    });

    it('throws NotFoundException for unknown lead', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(null);

      await expect(service.remove('org-1', 'ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ── optOut ─────────────────────────────────────────────────────────────────

  describe('optOut', () => {
    it('marks lead as opted-out', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(leadRow);
      mockPrisma.lead.update.mockResolvedValue({ ...leadRow, optedOut: true, status: 'OPT_OUT' });

      const result = await service.optOut('org-1', 'lead-1');

      expect(result.optedOut).toBe(true);
      expect(result.status).toBe('OPT_OUT');
    });
  });

  // ── bulkCreate ─────────────────────────────────────────────────────────────

  describe('bulkCreate', () => {
    it('throws BadRequestException when array exceeds 500', async () => {
      const dtos = Array.from({ length: 501 }, (_, i) => ({ name: `Lead ${i}`, source: 'csv' }));

      await expect(service.bulkCreate(tenant as any, dtos as any)).rejects.toThrow(BadRequestException);
    });

    it('counts created, duplicates, and errors correctly', async () => {
      const dtos = [
        { name: 'A', source: 'csv' },
        { name: 'B', source: 'csv' },
        { name: 'C', source: 'csv' },
      ] as any[];

      // A succeeds, B is a duplicate, C has a generic error
      mockDedup.checkDuplicate
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      mockPrisma.lead.create
        .mockResolvedValueOnce(leadRow)
        .mockRejectedValueOnce(new Error('Unexpected DB error'));

      const result = await service.bulkCreate(tenant as any, dtos);

      expect(result.created).toBe(1);
      expect(result.duplicates).toBe(1);
      expect(result.errors).toBe(1);
    });
  });

  // ── getStats ───────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns aggregated stats', async () => {
      mockPrisma.lead.count.mockResolvedValue(100);
      mockPrisma.lead.groupBy
        .mockResolvedValueOnce([{ tier: 'HOT', _count: { id: 10 } }])  // byTier
        .mockResolvedValueOnce([{ status: 'NEW', _count: { id: 90 } }]) // byStatus
        .mockResolvedValueOnce([{ source: 'linkedin', _count: { id: 100 } }]); // bySource
      mockPrisma.lead.aggregate.mockResolvedValue({ _avg: { score: 42 } });

      const result = await service.getStats('org-1');

      expect(result.total).toBe(100);
      expect(result.averageScore).toBe(42);
      expect(result.byTier).toEqual({ HOT: 10 });
      expect(result.byStatus).toEqual({ NEW: 90 });
      expect(result.bySource).toEqual({ linkedin: 100 });
    });

    it('returns averageScore 0 when no leads exist', async () => {
      mockPrisma.lead.count.mockResolvedValue(0);
      mockPrisma.lead.groupBy.mockResolvedValue([]).mockResolvedValue([]).mockResolvedValue([]);
      mockPrisma.lead.aggregate.mockResolvedValue({ _avg: { score: null } });

      const result = await service.getStats('org-1');

      expect(result.averageScore).toBe(0);
    });
  });
});
