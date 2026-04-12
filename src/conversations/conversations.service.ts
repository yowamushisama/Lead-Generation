import { TenantMode } from '../common/enums/tenant-mode.enum';
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { ConversationAssistantStage } from '../pipeline/stages/conversation-assistant.stage';
import { ObjectionHandlerService } from './objection-handler.service';
import { LeadStatus } from '../common/enums/lead-status.enum';
import {
  ConversationResponseDto,
  ConversationMessageEntryDto,
  ConversationLeadSummaryDto,
  ReplySuggestionsResponseDto,
} from './dto/conversation-response.dto';

/** Stored message entry shape (mirrors ConversationMessageEntryDto without class overhead) */
type StoredMessage = { role: 'us' | 'them'; content: string; timestamp: string };

/**
 * Cast a Prisma JSON field to a typed array.
 * Prisma stores JSON columns as `JsonValue` which cannot be directly assigned to typed
 * interfaces — the `unknown` bridge is the canonical TypeScript pattern for this case.
 */
function fromJsonArray<T>(json: import('@prisma/client').Prisma.JsonValue): T[] {
  return json as unknown as T[];
}

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly conversationAssistant: ConversationAssistantStage,
    private readonly objectionHandler: ObjectionHandlerService,
  ) {}

  async findAll(tenant: TenantContext, filters: { leadId?: string; status?: string }): Promise<ConversationResponseDto[]> {
    const rows = await this.prisma.conversation.findMany({
      where: {
        organizationId: tenant.organizationId,
        leadId: filters.leadId,
        status: filters.status,
      },
      include: {
        lead: { select: { id: true, name: true, role: true, company: true, score: true, tier: true } },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
    return rows.map((r) => this.toDto(r, r.lead));
  }

  async findOne(tenant: TenantContext, id: string): Promise<ConversationResponseDto> {
    const convo = await this.prisma.conversation.findFirst({
      where: { id, organizationId: tenant.organizationId },
      include: { lead: true },
    });
    if (!convo) throw new NotFoundException(`Conversation ${id} not found`);
    return this.toDto(convo, convo.lead);
  }

  async addReply(
    tenant: TenantContext,
    conversationId: string,
    content: string,
    fromUs: boolean,
  ): Promise<ConversationResponseDto> {
    const convo = await this.prisma.conversation.findFirst({
      where: { id: conversationId, organizationId: tenant.organizationId },
    });
    if (!convo) throw new NotFoundException(`Conversation ${conversationId} not found`);

    const messages = fromJsonArray<StoredMessage>(convo.messages);
    messages.push({ role: fromUs ? 'us' : 'them', content, timestamp: new Date().toISOString() });

    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        messages: messages as never,
        lastMessageAt: new Date(),
        messageCount: { increment: 1 },
      },
    });

    if (!fromUs) {
      await this.prisma.lead.update({
        where: { id: convo.leadId },
        data: { status: LeadStatus.REPLIED },
      });
    }

    return this.toDto(updated, null);
  }

  async getSuggestedReplies(
    tenant: TenantContext,
    conversationId: string,
  ): Promise<ReplySuggestionsResponseDto> {
    const convo = await this.prisma.conversation.findFirst({
      where: { id: conversationId, organizationId: tenant.organizationId },
      include: { lead: true },
    });
    if (!convo) throw new NotFoundException(`Conversation ${conversationId} not found`);

    const messages = fromJsonArray<StoredMessage>(convo.messages);
    const lastMessage = messages[messages.length - 1];

    if (!lastMessage || lastMessage.role !== 'them') {
      return {
        objectionDetected: false,
        objectionType: null,
        deterministicSuggestion: null,
        aiSuggestions: [],
        recommended: 'No incoming message to reply to',
        analysis: '',
      };
    }

    const objectionResponse = this.objectionHandler.detect(lastMessage.content);
    const org = await this.prisma.organization.findUnique({ where: { id: tenant.organizationId } });
    const lead = convo.lead as { role?: string; company?: string; painPoints?: string[] };

    const aiOutput = await this.conversationAssistant.process(
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

    const idx = aiOutput.recommendedApproach;
    const recommendedReply = aiOutput.suggestedReplies[idx];

    return {
      objectionDetected: objectionResponse.detected,
      objectionType: objectionResponse.detected ? objectionResponse.type : null,
      deterministicSuggestion: objectionResponse.detected ? (objectionResponse.exampleReply ?? null) : null,
      // Map ConversationReply objects to plain message strings for the API surface
      aiSuggestions: aiOutput.suggestedReplies.map((r) => r.message),
      recommended: recommendedReply?.approach ?? '',
      analysis: aiOutput.analysis,
    };
  }

  async create(tenant: TenantContext, leadId: string, channel: string): Promise<ConversationResponseDto> {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId: tenant.organizationId },
    });
    if (!lead) throw new NotFoundException(`Lead ${leadId} not found`);

    const convo = await this.prisma.conversation.create({
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

    return this.toDto(convo, null);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private toDto(
    convo: {
      id: string;
      organizationId: string;
      leadId: string;
      channel: string;
      messages: import('@prisma/client').Prisma.JsonValue;
      messageCount: number;
      lastMessageAt: Date;
      suggestedReply: string | null;
      objectionType: string | null;
      sentiment: string | null;
      closingStrategy: string | null;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    },
    lead: {
      id: string;
      name: string | null;
      role: string | null;
      company: string | null;
      score: number;
      tier: string;
    } | null,
  ): ConversationResponseDto {
    const messages = fromJsonArray<ConversationMessageEntryDto>(convo.messages) ?? [];
    const leadSummary: ConversationLeadSummaryDto | null = lead
      ? { id: lead.id, name: lead.name, role: lead.role, company: lead.company, score: lead.score, tier: lead.tier }
      : null;

    return {
      id: convo.id,
      organizationId: convo.organizationId,
      leadId: convo.leadId,
      channel: convo.channel,
      messages,
      messageCount: convo.messageCount,
      lastMessageAt: convo.lastMessageAt,
      suggestedReply: convo.suggestedReply,
      objectionType: convo.objectionType,
      sentiment: convo.sentiment,
      closingStrategy: convo.closingStrategy,
      status: convo.status,
      lead: leadSummary,
      createdAt: convo.createdAt,
      updatedAt: convo.updatedAt,
    };
  }
}
