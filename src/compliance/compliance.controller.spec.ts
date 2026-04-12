import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

const tenant = { organizationId: 'org-1', userId: 'user-1', role: 'admin' };

const retentionSummary = {
  totalLeads: 200,
  optedOut: 5,
  expiringSoon: 3,
  retentionPolicyDays: 90,
};

const exportData = {
  exportedAt: new Date().toISOString(),
  lead: {
    id: 'lead-1',
    name: 'Jane Doe',
    email: 'jane@example.com',
    role: 'CEO',
    company: 'Acme',
    source: 'linkedin',
    createdAt: new Date(),
    status: 'NEW',
    score: 55,
    messages: [],
    conversations: [],
  },
};

const mockComplianceService = {
  getRetentionSummary: jest.fn(),
  processOptOut: jest.fn(),
  exportLeadData: jest.fn(),
  deleteLeadData: jest.fn(),
};

describe('ComplianceController', () => {
  let controller: ComplianceController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ComplianceController],
      providers: [{ provide: ComplianceService, useValue: mockComplianceService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ComplianceController>(ComplianceController);
  });

  describe('getRetentionSummary', () => {
    it('returns retention summary without an expired field', async () => {
      mockComplianceService.getRetentionSummary.mockResolvedValue(retentionSummary);

      const res = await controller.getRetentionSummary(tenant as any);

      expect(res.success).toBe(true);
      expect((res.data as any).totalLeads).toBe(200);
      expect((res.data as any).expiringSoon).toBe(3);
      expect((res.data as any).retentionPolicyDays).toBe(90);
      // Confirm the removed field is not present
      expect((res.data as any).expired).toBeUndefined();
    });
  });

  describe('processOptOut', () => {
    it('returns success with null data on opt-out', async () => {
      mockComplianceService.processOptOut.mockResolvedValue(undefined);

      const res = await controller.processOptOut(tenant as any, 'lead-1');

      expect(res.success).toBe(true);
      expect(res.data).toBeNull();
      expect(mockComplianceService.processOptOut).toHaveBeenCalledWith(tenant, 'lead-1');
    });

    it('propagates NotFoundException for unknown lead', async () => {
      mockComplianceService.processOptOut.mockRejectedValue(new NotFoundException('Lead not found'));

      await expect(controller.processOptOut(tenant as any, 'ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('exportLeadData', () => {
    it('returns lead export with messages and conversations', async () => {
      mockComplianceService.exportLeadData.mockResolvedValue(exportData);

      const res = await controller.exportLeadData(tenant as any, 'lead-1');

      expect(res.success).toBe(true);
      expect((res.data as any).exportedAt).toBeDefined();
      expect((res.data as any).lead.id).toBe('lead-1');
    });

    it('propagates NotFoundException for unknown lead', async () => {
      mockComplianceService.exportLeadData.mockRejectedValue(new NotFoundException('Lead not found'));

      await expect(controller.exportLeadData(tenant as any, 'ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteLeadData', () => {
    it('returns success with null data on deletion', async () => {
      mockComplianceService.deleteLeadData.mockResolvedValue(undefined);

      const res = await controller.deleteLeadData(tenant as any, 'lead-1');

      expect(res.success).toBe(true);
      expect(res.data).toBeNull();
      expect(mockComplianceService.deleteLeadData).toHaveBeenCalledWith(tenant, 'lead-1');
    });

    it('propagates NotFoundException', async () => {
      mockComplianceService.deleteLeadData.mockRejectedValue(new NotFoundException('Lead not found'));

      await expect(controller.deleteLeadData(tenant as any, 'ghost')).rejects.toThrow(NotFoundException);
    });
  });
});
