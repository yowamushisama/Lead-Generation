import { TenantMode } from '../common/enums/tenant-mode.enum';
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { ConversationAssistantStage } from '../pipeline/stages/conversation-assistant.stage';
import { ObjectionHandlerService } from './objection-handler.service';
import { LeadStatus } from '../common/enums/lead-status.enum';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly conversationAssistant: ConversationAssistantStage,
    private readonly objectionHandler: ObjectionHandlerService,
  ) {}

  async findAll(tenant: TenantContext, filters: { leadId?: string; status?: string }) {
    return this.prisma.conversation.findMany({
      where: {
        organizationId: tenant.organizationId,
        leadId: filters.leadId,
        status: filters.status,
      },
      include: {
        lead: { select: { name: true, role: true, company: true, score: true } },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async findOne(tenant: TenantContext, id: string) {
    const convo = await this.prisma.conversation.findFirst({
      where: { id, organizationId: tenant.organizationId },
      include: { lead: true },
    });
    if (!convo) throw new NotFoundException(`Conversation ${id} not found`);
    return convo;
  }

  async addReply(tenant: TenantContext, conversationId: string, content: string, fromUs: boolean) {
    const convo = await this.findOne(tenant, conversationId);

    const messages = (convo.messages as Array<Record<string, unknown>>) ?? [];
    messages.push({
      role: fromUs ? 'us' : 'them',
      content,
      timestamp: new Date().toISOString(),
    });

    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        messages: messages as never,
        lastMessageAt: new Date(),
        messageCount: { increment: 1 },
      },
    });

    // If it's a reply from them, update lead status
    if (!fromUs) {
      await this.prisma.lead.update({
        where: { id: convo.leadId },
        data: { status: LeadStatus.REPLIED },
      });
    }

    return updated;
  }

  async getSuggestedReplies(tenant: TenantContext, conversationId: string) {
    const convo = await this.findOne(tenant, conversationId);
    const messages = (convo.messages as Array<{ role: 'us' | 'them'; content: string; timestamp: string }>) ?? [];

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'them') {
      return { error: 'No incoming message to reply to' };
    }

    // Check for objections first (deterministic)
    const objectionResponse = this.objectionHandler.detect(lastMessage.content);

    const org = await this.prisma.organization.findUnique({ where: { id: tenant.organizationId } });
    const lead = convo.lead as { role?: string; company?: string; painPoints?: string[] };

    const aiSuggestions = await this.conversationAssistant.process(
      {
        leadId: convo.leadId,
        conversationId,
        conversationHistory: messages,
        latestMessage: lastMessage.content,
        leadProfile: {
          role: lead.role,
          company: lead.company,
          painPoints: lead.painPoints ?? [],
        },
        serviceOffering: org?.serviceOffering ?? 'software development services',
        stage: objectionResponse.detected ? 'objection' : 'follow-up',
      },
      { organizationId: tenant.organizationId, userId: tenant.userId, mode: TenantMode.SINGLE },
    );

    return {
      objectionDetected: objectionResponse.detected,
      objectionType: objectionResponse.type,
      deterministicSuggestion: objectionResponse.detected ? objectionResponse.exampleReply : null,
      aiSuggestions: aiSuggestions.suggestedReplies,
      recommended: aiSuggestions.recommendedApproach,
      analysis: aiSuggestions.analysis,
    };
  }

  async create(tenant: TenantContext, leadId: string, channel: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId: tenant.organizationId },
    });
    if (!lead) throw new NotFoundException(`Lead ${leadId} not found`);

    return this.prisma.conversation.create({
      data: {
        organizationId: tenant.organizationId,
        leadId,
        channel,
        status: 'ACTIVE',
        messages: [],
        messageCount: 0,
        lastMessageAt: new Date(),
      },
    });
  }
}
