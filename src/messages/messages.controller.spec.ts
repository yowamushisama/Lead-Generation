import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

const tenant = { organizationId: 'org-1', userId: 'user-1', role: 'admin' };

const message = {
  id: 'msg-1',
  organizationId: 'org-1',
  leadId: 'lead-1',
  campaignId: null,
  channel: 'linkedin-dm',
  subject: null,
  body: 'Hi Jane, ...',
  status: 'PENDING_APPROVAL',
  type: 'OUTREACH',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const messageWithLead = {
  ...message,
  lead: { id: 'lead-1', name: 'Jane Doe', role: 'CEO', company: 'Acme', score: 55, tier: 'WARM' },
};

const mockMessagesService = {
  create: jest.fn(),
  findAll: jest.fn(),
  getPendingApproval: jest.fn(),
  findOne: jest.fn(),
  approve: jest.fn(),
  reject: jest.fn(),
  markSent: jest.fn(),
};

describe('MessagesController', () => {
  let controller: MessagesController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [{ provide: MessagesService, useValue: mockMessagesService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MessagesController>(MessagesController);
  });

  describe('create', () => {
    it('returns created message draft', async () => {
      mockMessagesService.create.mockResolvedValue(message);

      const res = await controller.create(tenant as any, { leadId: 'lead-1', channel: 'linkedin-dm' } as any);

      expect(res.success).toBe(true);
      expect((res.data as any).status).toBe('PENDING_APPROVAL');
    });
  });

  describe('findAll', () => {
    it('returns message list', async () => {
      mockMessagesService.findAll.mockResolvedValue([message]);

      const res = await controller.findAll(tenant as any);

      expect(res.success).toBe(true);
      expect(Array.isArray(res.data)).toBe(true);
    });

    it('passes filters to the service', async () => {
      mockMessagesService.findAll.mockResolvedValue([]);

      await controller.findAll(tenant as any, 'lead-1', 'SENT', 'camp-1');

      expect(mockMessagesService.findAll).toHaveBeenCalledWith(tenant, { leadId: 'lead-1', status: 'SENT', campaignId: 'camp-1' });
    });
  });

  describe('getPendingApproval', () => {
    it('returns messages pending approval with embedded lead', async () => {
      mockMessagesService.getPendingApproval.mockResolvedValue([messageWithLead]);

      const res = await controller.getPendingApproval(tenant as any);

      expect(res.success).toBe(true);
      expect((res.data as any[])[0].lead.name).toBe('Jane Doe');
    });
  });

  describe('findOne', () => {
    it('returns a single message', async () => {
      mockMessagesService.findOne.mockResolvedValue(message);

      const res = await controller.findOne(tenant as any, 'msg-1');

      expect((res.data as any).id).toBe('msg-1');
    });

    it('propagates NotFoundException', async () => {
      mockMessagesService.findOne.mockRejectedValue(new NotFoundException('Not found'));

      await expect(controller.findOne(tenant as any, 'ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('approve', () => {
    it('returns approved message', async () => {
      mockMessagesService.approve.mockResolvedValue({ ...message, status: 'APPROVED' });

      const res = await controller.approve(tenant as any, 'msg-1', {} as any);

      expect((res.data as any).status).toBe('APPROVED');
    });
  });

  describe('reject', () => {
    it('returns rejected message', async () => {
      mockMessagesService.reject.mockResolvedValue({ ...message, status: 'REJECTED' });

      const res = await controller.reject(tenant as any, 'msg-1', 'Spam risk');

      expect((res.data as any).status).toBe('REJECTED');
      expect(mockMessagesService.reject).toHaveBeenCalledWith(tenant, 'msg-1', 'Spam risk');
    });
  });

  describe('markSent', () => {
    it('returns message with SENT status', async () => {
      mockMessagesService.markSent.mockResolvedValue({ ...message, status: 'SENT' });

      const res = await controller.markSent(tenant as any, 'msg-1');

      expect((res.data as any).status).toBe('SENT');
    });
  });
});
