import { TenantMode } from '../../common/enums/tenant-mode.enum';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../common/constants/queue-names';
import { PipelineJobData } from '../orchestrator.service';
import { OutreachGeneratorStage } from '../stages/outreach-generator.stage';
import { ColdCallScriptGeneratorStage } from '../stages/cold-call-script-generator.stage';
import { LeadRepository } from '../../database/repositories/lead.repository';
import { MessageRepository } from '../../database/repositories/message.repository';
import { OrganizationRepository } from '../../database/repositories/organization.repository';
import { ReportArtifactRepository } from '../../database/repositories/report-artifact.repository';
import { LeadStatus } from '../../common/enums/lead-status.enum';
import { PersonalizationResult } from '../../common/types/personalization.types';
import { MessageStatus } from '../../common/enums/message-status.enum';
import { AppConfigService } from '../../config/config.service';
import { OutreachReportInsights } from '../../ai/prompts/outreach.prompt';
import { DeepReportArtifactMetadata } from '../stages/deep-report-generator.stage';
import { DeepSignals } from '../stages/website-enricher.types';

@Processor(QUEUE_NAMES.OUTREACH)
export class OutreachProcessor extends WorkerHost {
  private readonly logger = new Logger(OutreachProcessor.name);

  constructor(
    private readonly outreachStage: OutreachGeneratorStage,
    private readonly coldCallStage: ColdCallScriptGeneratorStage,
    private readonly leadRepository: LeadRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly messageRepository: MessageRepository,
    private readonly reportRepository: ReportArtifactRepository,
    private readonly config: AppConfigService,
  ) {
    super();
  }

  async process(job: Job<PipelineJobData>): Promise<void> {
    const { leadId, organizationId, userId, campaignId } = job.data;
    const context = { organizationId, userId, mode: TenantMode.SINGLE };

    this.logger.log({ message: `Processing outreach job`, jobId: job.id, leadId });

    try {
      if (!leadId) throw new Error(`Outreach job ${job.id} is missing leadId`);
      const [lead, org, latestReport] = await Promise.all([
        this.leadRepository.findUnique({ where: { id: leadId } }),
        this.organizationRepository.findUnique({ where: { id: organizationId } }),
        this.reportRepository.findLatest(leadId, 'WEBSITE_REPORT'),
      ]);

      if (!lead) throw new Error(`Lead ${leadId} not found`);
      if (!lead.personalizationData) throw new Error(`Lead ${leadId} has no personalization data`);

      const personalization = lead.personalizationData as unknown as PersonalizationResult;
      const serviceOffering = org?.serviceOffering ?? 'software development services';

      const reportMetadata =
        (latestReport?.metadata as unknown as DeepReportArtifactMetadata | null) ?? null;
      const reportInsights = this.buildOutreachInsights(reportMetadata);

      const output = await this.outreachStage.process(
        {
          leadId,
          recipientName: lead.name,
          recipientRole: lead.role ?? undefined,
          personalization,
          serviceOffering,
          campaignId,
          reportInsights,
        },
        context,
      );

      // Persist each generated email
      for (const msg of output.messages) {
        await this.messageRepository.create({
          data: {
            organizationId,
            leadId,
            campaignId,
            channel: msg.channel,
            subject: msg.subject,
            body: msg.body,
            spamScore: msg.spamScore,
            status: msg.isApproved ? MessageStatus.PENDING_APPROVAL : MessageStatus.REJECTED,
            promptConfigId: output.promptConfigId,
            promptVersion: output.promptVersion,
            generatedAt: new Date(),
          },
        });
      }

      await this.leadRepository.update({
        where: { id: leadId },
        data: { status: LeadStatus.MESSAGE_DRAFTED },
      });

      this.logger.log({
        message: `Outreach messages created for lead ${leadId}`,
        count: output.messages.length,
        approved: output.messages.filter((m) => m.isApproved).length,
        organizationId,
      });

      // ── Cold-call script (env-gated, NON-FATAL) ─────────────────────────────
      if (this.shouldGenerateColdCallScript(lead, latestReport, reportMetadata)) {
        await this.runColdCallScript({
          leadId,
          organizationId,
          campaignId,
          lead,
          reportId: latestReport!.id,
          reportMetadata: reportMetadata!,
          context,
        });
      }
    } catch (error) {
      this.logger.error({
        message: `Outreach processor error`,
        jobId: job.id,
        error: String(error),
      });
      throw error;
    }
  }

  private buildOutreachInsights(
    metadata: DeepReportArtifactMetadata | null,
  ): OutreachReportInsights | undefined {
    if (!metadata) return undefined;
    const topPP = metadata.painPoints?.[0];
    const angle = metadata.emailAngles?.[0];
    return {
      topPainPointTitle: topPP?.title,
      topPainPointEvidence: topPP?.evidence,
      topOpportunity: metadata.topOpportunity?.title,
      primaryEmailAngle: angle
        ? {
            hook: angle.hook,
            evidence: angle.evidence,
            valueProp: angle.valueProp,
            cta: angle.cta,
          }
        : undefined,
      deepSignalEvidence: this.summarizeDeepSignal(metadata.deepSignalsSnapshot),
    };
  }

  private summarizeDeepSignal(ds?: DeepSignals): string | undefined {
    if (!ds) return undefined;
    if (!ds.hasChatbot) return 'no AI chatbot — after-hours leads bounce';
    if (!ds.hasBookingWidget) return 'no online booking widget — every lead requires a phone call';
    if (!ds.hasEstimateCalculator) return 'no instant estimate tool on the site';
    if (ds.formFieldCount !== null && ds.formFieldCount < 4)
      return `only ${ds.formFieldCount}-field contact form — leaks unqualified leads`;
    if (!ds.hasSchemaMarkup) return 'no schema markup — invisible to Google rich results';
    if (ds.detectedCrm.length === 0) return 'no CRM detected — manual lead handoff';
    return undefined;
  }

  private shouldGenerateColdCallScript(
    lead: { phone: string | null; tier: string | null },
    latestReport: { id: string } | null,
    reportMetadata: DeepReportArtifactMetadata | null,
  ): boolean {
    if (!this.config.enableColdCallScript) return false;
    if (!lead.phone) return false;
    if (lead.tier !== 'HOT' && lead.tier !== 'WARM') return false;
    if (!latestReport || !reportMetadata) return false;
    if (!reportMetadata.coldCallAngles?.length) return false;
    return true;
  }

  private async runColdCallScript(args: {
    leadId: string;
    organizationId: string;
    campaignId?: string;
    lead: Record<string, unknown>;
    reportId: string;
    reportMetadata: DeepReportArtifactMetadata;
    context: { organizationId: string; userId: string; mode: TenantMode };
  }): Promise<void> {
    try {
      const { lead, reportMetadata } = args;
      await this.coldCallStage.process(
        {
          leadId: args.leadId,
          organizationId: args.organizationId,
          campaignId: args.campaignId ?? null,
          sourcedFromReportId: args.reportId,
          promptInput: {
            leadName: (lead.name as string) ?? 'Unknown',
            company: (lead.company as string | null) ?? null,
            industry: (lead.industry as string | null) ?? null,
            location: (lead.location as string | null) ?? null,
            rating: (lead.rating as number | null) ?? null,
            reviewCount: (lead.reviewCount as number | null) ?? null,
            painPoints: reportMetadata.painPoints,
            topOpportunity: reportMetadata.topOpportunity,
            coldCallAngles: reportMetadata.coldCallAngles,
            deepSignals: reportMetadata.deepSignalsSnapshot,
          },
        },
        args.context,
      );
    } catch (err) {
      // Non-fatal: a failed script generation must not affect the email or lead status
      this.logger.warn({
        message: 'Cold-call script generation threw — non-fatal',
        leadId: args.leadId,
        organizationId: args.organizationId,
        error: String(err),
      });
    }
  }
}
