import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';

const tenant = { organizationId: 'org-1', userId: 'user-1', role: 'admin' };

const org = {
  id: 'org-1',
  name: 'Acme Corp',
  slug: 'acme-corp',
  tier: 'starter',
  maxLeadsPerDay: 50,
  maxAiTokensPerMonth: '1000000',
  serviceOffering: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const orgStats = {
  organization: { id: 'org-1', name: 'Acme Corp', tier: 'starter', maxLeadsPerDay: 50 },
  leads: { today: 12, total: 1200, hot: 48, remainingToday: 38 },
  usage: { aiTokensUsed: '12345', aiCostCents: 49, scrapesExecuted: 3, leadsProcessed: 12, apiCallsMade: 180 },
};

const mockOrganizationsService = {
  create: jest.fn(),
  findById: jest.fn(),
  findBySlug: jest.fn(),
  update: jest.fn(),
  getStats: jest.fn(),
};

describe('OrganizationsController', () => {
  let controller: OrganizationsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [{ provide: OrganizationsService, useValue: mockOrganizationsService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OrganizationsController>(OrganizationsController);
  });

  describe('getMyOrganization', () => {
    it('returns current tenant organization', async () => {
      mockOrganizationsService.findById.mockResolvedValue(org);

      const res = await controller.getMyOrganization(tenant as any);

      expect(res.success).toBe(true);
      expect((res.data as any).slug).toBe('acme-corp');
      expect(mockOrganizationsService.findById).toHaveBeenCalledWith('org-1');
    });
  });

  describe('getStats', () => {
    it('returns nested stats with organization/leads/usage shape', async () => {
      mockOrganizationsService.getStats.mockResolvedValue(orgStats);

      const res = await controller.getStats(tenant as any);

      expect(res.success).toBe(true);
      expect((res.data as any).leads.today).toBe(12);
      expect((res.data as any).organization.maxLeadsPerDay).toBe(50);
      expect((res.data as any).usage.aiTokensUsed).toBe('12345');
    });
  });

  describe('updateMyOrganization', () => {
    it('updates and returns the organization', async () => {
      mockOrganizationsService.update.mockResolvedValue({ ...org, name: 'New Name' });

      const res = await controller.updateMyOrganization(tenant as any, { name: 'New Name' } as any);

      expect((res.data as any).name).toBe('New Name');
      expect(mockOrganizationsService.update).toHaveBeenCalledWith('org-1', { name: 'New Name' });
    });

    it('propagates ConflictException on slug collision', async () => {
      mockOrganizationsService.update.mockRejectedValue(new ConflictException('Slug taken'));

      await expect(controller.updateMyOrganization(tenant as any, { slug: 'taken' } as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('create (superadmin)', () => {
    it('creates and returns a new organization', async () => {
      mockOrganizationsService.create.mockResolvedValue(org);

      const res = await controller.create({ name: 'Acme Corp', slug: 'acme-corp' } as any);

      expect(res.success).toBe(true);
      expect((res.data as any).id).toBe('org-1');
    });

    it('propagates ConflictException for duplicate slug', async () => {
      mockOrganizationsService.create.mockRejectedValue(new ConflictException('Slug taken'));

      await expect(controller.create({ name: 'X', slug: 'taken' } as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne (superadmin)', () => {
    it('returns organization by ID', async () => {
      mockOrganizationsService.findById.mockResolvedValue(org);

      const res = await controller.findOne('org-1');

      expect((res.data as any).id).toBe('org-1');
    });

    it('propagates NotFoundException', async () => {
      mockOrganizationsService.findById.mockRejectedValue(new NotFoundException('Not found'));

      await expect(controller.findOne('ghost')).rejects.toThrow(NotFoundException);
    });
  });
});
