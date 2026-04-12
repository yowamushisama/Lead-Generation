import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

const tenant = { organizationId: 'org-1', userId: 'user-1', role: 'admin' };

const conversation = {
  id: 'conv-1',
  organizationId: 'org-1',
  leadId: 'lead-1',
  channel: 'linkedin-dm',
  messages: [],
  messageCount: 0,
  status: 'ACTIVE',
  lead: { id: 'lead-1', name: 'Jane Doe', role: 'CEO', company: 'Acme', score: 55, tier: 'WARM' },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const suggestions = {
  conversationId: 'conv-1',
  suggestions: ['Try this angle', 'Follow up on budget'],
  objectionType: null,
  sentiment: 'neutral',
  closingStrategy: 'value-proposition',
};

const mockConversationsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  getSuggestedReplies: jest.fn(),
  addReply: jest.fn(),
};

describe('ConversationsController', () => {
  let controller: ConversationsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationsController],
      providers: [{ provide: ConversationsService, useValue: mockConversationsService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ConversationsController>(ConversationsController);
  });

  describe('create', () => {
    it('starts a new conversation and returns it', async () => {
      mockConversationsService.create.mockResolvedValue(conversation);

      const res = await controller.create(tenant as any, { leadId: 'lead-1', channel: 'linkedin-dm' });

      expect(res.success).toBe(true);
      expect((res.data as any).id).toBe('conv-1');
      expect(mockConversationsService.create).toHaveBeenCalledWith(tenant, 'lead-1', 'linkedin-dm');
    });

    it('propagates NotFoundException when lead does not exist', async () => {
      mockConversationsService.create.mockRejectedValue(new NotFoundException('Lead not found'));

      await expect(controller.create(tenant as any, { leadId: 'ghost', channel: 'linkedin-dm' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('returns conversation list', async () => {
      mockConversationsService.findAll.mockResolvedValue([conversation]);

      const res = await controller.findAll(tenant as any);

      expect(res.success).toBe(true);
      expect(Array.isArray(res.data)).toBe(true);
    });

    it('passes leadId and status filters', async () => {
      mockConversationsService.findAll.mockResolvedValue([]);

      await controller.findAll(tenant as any, 'lead-1', 'ACTIVE');

      expect(mockConversationsService.findAll).toHaveBeenCalledWith(tenant, { leadId: 'lead-1', status: 'ACTIVE' });
    });
  });

  describe('findOne', () => {
    it('returns a single conversation with lead summary', async () => {
      mockConversationsService.findOne.mockResolvedValue(conversation);

      const res = await controller.findOne(tenant as any, 'conv-1');

      expect((res.data as any).lead.tier).toBe('WARM');
    });

    it('propagates NotFoundException', async () => {
      mockConversationsService.findOne.mockRejectedValue(new NotFoundException('Not found'));

      await expect(controller.findOne(tenant as any, 'ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSuggestedReplies', () => {
    it('returns AI reply suggestions', async () => {
      mockConversationsService.getSuggestedReplies.mockResolvedValue(suggestions);

      const res = await controller.getSuggestedReplies(tenant as any, 'conv-1');

      expect(res.success).toBe(true);
      expect(Array.isArray((res.data as any).suggestions)).toBe(true);
    });
  });

  describe('addReply', () => {
    it('appends a message and returns updated conversation', async () => {
      const updated = { ...conversation, messageCount: 1 };
      mockConversationsService.addReply.mockResolvedValue(updated);

      const res = await controller.addReply(tenant as any, 'conv-1', { content: 'Hi!', fromUs: true });

      expect((res.data as any).messageCount).toBe(1);
      expect(mockConversationsService.addReply).toHaveBeenCalledWith(tenant, 'conv-1', 'Hi!', true);
    });
  });
});
