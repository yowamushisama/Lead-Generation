import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Purge leads whose data retention period has expired.
   * Called by daily cron job.
   */
  async purgeExpiredData(): Promise<{ deletedLeads: number; anonymizedLeads: number }> {
    const now = new Date();

    // Delete leads past their expiry (hard delete — they opted out or retention expired)
    const expiredLeads = await this.prisma.lead.findMany({
      where: { dataExpiresAt: { lte: now } },
      select: { id: true, organizationId: true },
    });

    let deletedLeads = 0;
    let anonymizedLeads = 0;

    for (const lead of expiredLeads) {
      try {
        // Soft anonymize if they converted (keep analytics, remove PII)
        const fullLead = await this.prisma.lead.findUnique({ where: { id: lead.id } });
        if (fullLead?.status === 'CONVERTED') {
          await this.prisma.lead.update({
            where: { id: lead.id },
            data: {
              name: '[Anonymized]',
              email: null,
              phone: null,
              bio: null,
              originalContent: null,
              sourceUrl: null,
              dataExpiresAt: null,
            },
          });
          anonymizedLeads++;
        } else {
          await this.prisma.lead.delete({ where: { id: lead.id } });
          deletedLeads++;
        }
      } catch (error) {
        this.logger.error({
          message: `Failed to purge lead ${lead.id}`,
          error: String(error),
        });
      }
    }

    this.logger.log({
      message: `Data retention purge complete`,
      deletedLeads,
      anonymizedLeads,
    });

    return { deletedLeads, anonymizedLeads };
  }

  async scheduleForDeletion(leadId: string, organizationId: string, daysUntilDeletion = 30): Promise<void> {
    const expiresAt = new Date(Date.now() + daysUntilDeletion * 24 * 60 * 60 * 1000);
    await this.prisma.lead.update({
      where: { id: leadId },
      data: { dataExpiresAt: expiresAt },
    });

    this.logger.log({
      message: `Lead ${leadId} scheduled for deletion in ${daysUntilDeletion} days`,
      organizationId,
      expiresAt,
    });
  }
}
