import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { CampaignRepository } from '../database/repositories/campaign.repository';
import { LeadRepository } from '../database/repositories/lead.repository';
import { MessageRepository } from '../database/repositories/message.repository';
import { PrismaTransactionService } from '../database/repositories/prisma-transaction.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { CreateMessageDto } from './dto/create-message.dto';
import { ApproveMessageDto } from './dto/approve-message.dto';
import { MessageStatus } from '../common/enums/message-status.enum';
import { LeadStatus } from '../common/enums/lead-status.enum';
import { AntiSpamService } from './anti-spam.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly leadRepository: LeadRepository,
    private readonly campaignRepository: CampaignRepository,
    private readonly messageRepository: MessageRepository,
    private readonly transaction: PrismaTransactionService,
    private readonly antiSpam: AntiSpamService,
  ) {}

  async create(tenant: TenantContext, dto: CreateMessageDto) {
    // Verify the lead belongs to this tenant and has not opted out
    const lead = await this.leadRepository.findFirst({
      where: { id: dto.leadId, organizationId: tenant.organizationId, optedOut: false },
    });
    if (!lead) {
      throw new ForbiddenException(
        `Lead ${dto.leadId} not found in your organization or has opted out`,
      );
    }

    // Verify campaign belongs to this tenant if provided
    if (dto.campaignId) {
      const campaign = await this.campaignRepository.findFirst({
        where: { id: dto.campaignId, organizationId: tenant.organizationId },
      });
      if (!campaign) {
        throw new ForbiddenException(`Campaign ${dto.campaignId} not found in your organization`);
      }
    }

    const spamCheck = this.antiSpam.check(dto.body);

    return this.messageRepository.create({
      data: {
        organizationId: tenant.organizationId,
        leadId: dto.leadId,
        campaignId: dto.campaignId,
        channel: dto.channel,
        subject: dto.subject,
        body: dto.body,
        spamScore: dto.spamScore ?? spamCheck.spamScore,
        status: spamCheck.isApproved ? MessageStatus.PENDING_APPROVAL : MessageStatus.REJECTED,
        generatedAt: new Date(),
      },
    });
  }

  async findAll(
    tenant: TenantContext,
    filters: { leadId?: string; status?: string; campaignId?: string },
  ) {
    return this.messageRepository.findMany({
      where: {
        organizationId: tenant.organizationId,
        leadId: filters.leadId,
        status: filters.status as MessageStatus | undefined,
        campaignId: filters.campaignId,
      },
      orderBy: { generatedAt: 'desc' },
      take: 100,
    });
  }

  async findOne(tenant: TenantContext, id: string) {
    const message = await this.messageRepository.findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    if (!message) throw new NotFoundException(`Message ${id} not found`);
    return message;
  }

  async approve(tenant: TenantContext, id: string, dto: ApproveMessageDto) {
    const message = await this.findOne(tenant, id);

    if (message.status === MessageStatus.SENT) {
      throw new BadRequestException('Message already sent');
    }

    const body = dto.editedBody ?? message.body;
    const spamCheck = this.antiSpam.check(body);

    if (!spamCheck.isApproved) {
      throw new BadRequestException(
        `Message still has spam patterns: ${spamCheck.burntPatterns.join(', ')}`,
      );
    }

    return this.transaction.run(async (tx) => {
      const updated = await this.messageRepository.update({
        where: { id },
        data: {
          body,
          subject: dto.editedSubject ?? message.subject,
          status: MessageStatus.APPROVED,
          approvedAt: new Date(),
          approvedBy: tenant.userId,
          spamScore: spamCheck.spamScore,
        },
      }, tx);

      // Scope lead update by both id and organizationId
      await this.leadRepository.updateMany({
        where: { id: message.leadId, organizationId: tenant.organizationId },
        data: { status: LeadStatus.MESSAGE_APPROVED },
      }, tx);

      this.logger.log({
        message: `Message ${id} approved`,
        organizationId: tenant.organizationId,
        userId: tenant.userId,
      });

      return updated;
    });
  }

  async reject(tenant: TenantContext, id: string, reason?: string) {
    // findOne already enforces tenant scope
    await this.findOne(tenant, id);

    return this.messageRepository.update({
      where: { id },
      data: {
        status: MessageStatus.REJECTED,
        metadata: { rejectionReason: reason ?? 'Manually rejected' } as never,
      },
    });
  }

  async markSent(tenant: TenantContext, id: string) {
    const message = await this.findOne(tenant, id);

    if (message.status !== MessageStatus.APPROVED) {
      throw new BadRequestException('Message must be approved before marking as sent');
    }

    return this.transaction.run(async (tx) => {
      const updated = await this.messageRepository.update({
        where: { id },
        data: { status: MessageStatus.SENT, sentAt: new Date() },
      }, tx);

      // Scope lead update by both id and organizationId
      await this.leadRepository.updateMany({
        where: { id: message.leadId, organizationId: tenant.organizationId },
        data: { status: LeadStatus.OUTREACH_SENT },
      }, tx);

      return updated;
    });
  }

  async getPendingApproval(tenant: TenantContext) {
    return this.messageRepository.findMany({
      where: {
        organizationId: tenant.organizationId,
        status: MessageStatus.PENDING_APPROVAL,
      },
      include: {
        lead: { select: { id: true, name: true, role: true, company: true, score: true, tier: true } },
      },
      orderBy: [{ lead: { score: 'desc' } }, { generatedAt: 'desc' }],
    });
  }
}
