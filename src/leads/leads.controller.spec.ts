import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';

// ── Fixtures ───────────────────────────────────────────────────────────────

const tenant = { organizationId: 'org-1', userId: 'user-1', role: 'admin' };

const lead = {
  id: 'lead-1',
  organizationId: 'org-1',
  name: 'Jane Doe',
  source: 'linkedin',
  status: 'NEW',
  tier: 'COLD',
  score: 30,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const paginatedLeads = {
  data: [lead],
  meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
};

const mockLeadsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  optOut: jest.fn(),
  bulkCreate: jest.fn(),
  getStats: jest.fn(),
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('LeadsController', () => {
  let controller: LeadsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeadsController],
      providers: [{ provide: LeadsService, useValue: mockLeadsService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<LeadsController>(LeadsController);
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('returns created lead wrapped in ApiResponse', async () => {
      mockLeadsService.create.mockResolvedValue(lead);

      const res = await controller.create(tenant as any, { name: 'Jane Doe', source: 'linkedin' } as any);

      expect(res.success).toBe(true);
      expect(res.data).toEqual(lead);
    });

    it('propagates ConflictException for duplicate leads', async () => {
      mockLeadsService.create.mockRejectedValue(new ConflictException('Duplicate'));

      await expect(
        controller.create(tenant as any, { name: 'Jane Doe', source: 'linkedin' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated lead list', async () => {
      mockLeadsService.findAll.mockResolvedValue(paginatedLeads);

      const res = await controller.findAll(tenant as any, {} as any);

      expect(res.success).toBe(true);
      expect(res.data).toEqual(paginatedLeads);
    });
  });

  // ── getStats ───────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns lead stats object', async () => {
      const stats = { total: 100, averageScore: 42, byTier: { HOT: 10 }, byStatus: { NEW: 90 }, bySource: { linkedin: 100 } };
      mockLeadsService.getStats.mockResolvedValue(stats);

      const res = await controller.getStats(tenant as any);

      expect(res.success).toBe(true);
      expect(res.data).toEqual(stats);
      expect(mockLeadsService.getStats).toHaveBeenCalledWith('org-1');
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns single lead', async () => {
      mockLeadsService.findOne.mockResolvedValue(lead);

      const res = await controller.findOne(tenant as any, 'lead-1');

      expect(res.success).toBe(true);
      expect(res.data).toEqual(lead);
    });

    it('propagates NotFoundException', async () => {
      mockLeadsService.findOne.mockRejectedValue(new NotFoundException('Not found'));

      await expect(controller.findOne(tenant as any, 'ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('returns updated lead', async () => {
      const updated = { ...lead, status: 'REPLIED' };
      mockLeadsService.update.mockResolvedValue(updated);

      const res = await controller.update(tenant as any, 'lead-1', { status: 'REPLIED' } as any);

      expect(res.success).toBe(true);
      expect((res.data as any).status).toBe('REPLIED');
    });
  });

  // ── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('calls service remove and returns void (204)', async () => {
      mockLeadsService.remove.mockResolvedValue(undefined);

      await expect(controller.remove(tenant as any, 'lead-1')).resolves.toBeUndefined();
      expect(mockLeadsService.remove).toHaveBeenCalledWith('org-1', 'lead-1');
    });

    it('propagates NotFoundException', async () => {
      mockLeadsService.remove.mockRejectedValue(new NotFoundException('Not found'));

      await expect(controller.remove(tenant as any, 'ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ── optOut ─────────────────────────────────────────────────────────────────

  describe('optOut', () => {
    it('returns opted-out lead', async () => {
      const optedOut = { ...lead, status: 'OPT_OUT', optedOut: true };
      mockLeadsService.optOut.mockResolvedValue(optedOut);

      const res = await controller.optOut(tenant as any, 'lead-1');

      expect(res.success).toBe(true);
      expect((res.data as any).status).toBe('OPT_OUT');
    });
  });

  // ── bulkCreate ─────────────────────────────────────────────────────────────

  describe('bulkCreate', () => {
    it('returns created/duplicate/error counts', async () => {
      mockLeadsService.bulkCreate.mockResolvedValue({ created: 10, duplicates: 2, errors: 0 });

      const res = await controller.bulkCreate(tenant as any, [{ name: 'A', source: 'csv' }] as any);

      expect(res.success).toBe(true);
      expect((res.data as any).created).toBe(10);
      expect((res.data as any).duplicates).toBe(2);
    });
  });
});
