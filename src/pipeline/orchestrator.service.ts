import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { RawLeadInput } from '../common/interfaces/lead-input.interface';
import { QUEUE_NAMES, JOB_NAMES } from '../common/constants/queue-names';

export interface PipelineJobData {
  leadId: string;
  organizationId: string;
  userId: string;
  campaignId?: string;
  rawInput?: RawLeadInput;
  priority?: number;
}

export interface PipelineOptions {
  campaignId?: string;
  priority?: number;
  skipStages?: string[];
  startFrom?: 'intent' | 'enrich' | 'score' | 'personalize' | 'outreach';
  /** When true, uses a deterministic BullMQ jobId derived from orgId:source:externalId to prevent in-flight duplicates. */
  dedupKey?: boolean;
}

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.INTENT) private readonly intentQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ENRICH) private readonly enrichQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SCORE) private readonly scoreQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PERSONALIZE) private readonly personalizeQueue: Queue,
    @InjectQueue(QUEUE_NAMES.OUTREACH) private readonly outreachQueue: Queue,
  ) {}

  async enqueueLead(
    rawInput: RawLeadInput,
    context: TenantContext,
    options: PipelineOptions = {},
  ): Promise<string> {
    const jobData: PipelineJobData = {
      leadId: '',
      organizationId: context.organizationId,
      userId: context.userId,
      campaignId: options.campaignId,
      rawInput,
      priority: options.priority ?? 0,
    };

    const startFrom = options.startFrom ?? 'intent';
    const queue = this.getQueueForStage(startFrom);

    const jobId =
      options.dedupKey && rawInput.externalId
        ? createHash('sha256')
            .update(`${context.organizationId}:${rawInput.source}:${rawInput.externalId}`)
            .digest('hex')
            .slice(0, 40)
        : undefined;

    const job = await queue.add(JOB_NAMES.CLASSIFY_INTENT, jobData, {
      jobId,
      priority: options.priority ?? 0,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    });

    this.logger.log({
      message: `Lead enqueued to ${startFrom} pipeline`,
      module: 'OrchestratorService',
      correlationId: job.id,
      organizationId: context.organizationId,
      jobId: job.id,
      startFrom,
    });

    return job.id ?? '';
  }

  async enqueueLeadBatch(
    rawInputs: RawLeadInput[],
    context: TenantContext,
    options: PipelineOptions = {},
  ): Promise<string[]> {
    const jobIds: string[] = [];

    for (const rawInput of rawInputs) {
      const jobId = await this.enqueueLead(rawInput, context, options);
      jobIds.push(jobId);
    }

    this.logger.log({
      message: `Batch enqueued: ${jobIds.length} leads`,
      module: 'OrchestratorService',
      organizationId: context.organizationId,
      count: jobIds.length,
    });

    return jobIds;
  }

  async enqueueForStage(
    leadId: string,
    stage: 'enrich' | 'score' | 'personalize' | 'outreach',
    context: TenantContext,
    options: PipelineOptions = {},
  ): Promise<string> {
    const jobData: PipelineJobData = {
      leadId,
      organizationId: context.organizationId,
      userId: context.userId,
      campaignId: options.campaignId,
    };

    const queue = this.getQueueForStage(stage);
    const jobName = this.getJobNameForStage(stage);

    const job = await queue.add(jobName, jobData, {
      priority: options.priority ?? 0,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });

    this.logger.log({
      message: `Lead ${leadId} enqueued to ${stage} stage`,
      module: 'OrchestratorService',
      organizationId: context.organizationId,
      leadId,
      stage,
      jobId: job.id,
    });

    return job.id ?? '';
  }

  async getQueueStats(): Promise<Record<string, unknown>> {
    const queues = [
      { name: QUEUE_NAMES.INTENT, queue: this.intentQueue },
      { name: QUEUE_NAMES.ENRICH, queue: this.enrichQueue },
      { name: QUEUE_NAMES.SCORE, queue: this.scoreQueue },
      { name: QUEUE_NAMES.PERSONALIZE, queue: this.personalizeQueue },
      { name: QUEUE_NAMES.OUTREACH, queue: this.outreachQueue },
    ];

    const stats: Record<string, unknown> = {};

    for (const { name, queue } of queues) {
      const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
      ]);

      stats[name] = { waiting, active, completed, failed };
    }

    return stats;
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueueByName(queueName);
    await queue.pause();
    this.logger.warn({
      message: `Queue paused: ${queueName}`,
      module: 'OrchestratorService',
    });
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueueByName(queueName);
    await queue.resume();
    this.logger.log({
      message: `Queue resumed: ${queueName}`,
      module: 'OrchestratorService',
    });
  }

  private getQueueForStage(stage: string): Queue {
    switch (stage) {
      case 'intent':
        return this.intentQueue;
      case 'enrich':
        return this.enrichQueue;
      case 'score':
        return this.scoreQueue;
      case 'personalize':
        return this.personalizeQueue;
      case 'outreach':
        return this.outreachQueue;
      default:
        throw new Error(`Unknown pipeline stage: ${stage}`);
    }
  }

  private getJobNameForStage(stage: string): string {
    switch (stage) {
      case 'intent':
        return JOB_NAMES.CLASSIFY_INTENT;
      case 'enrich':
        return JOB_NAMES.ENRICH_LEAD;
      case 'score':
        return JOB_NAMES.SCORE_LEAD;
      case 'personalize':
        return JOB_NAMES.PERSONALIZE_LEAD;
      case 'outreach':
        return JOB_NAMES.SEND_OUTREACH;
      default:
        throw new Error(`Unknown pipeline stage: ${stage}`);
    }
  }

  private getQueueByName(name: string): Queue {
    const queueMap = new Map<string, Queue>([
      [QUEUE_NAMES.INTENT, this.intentQueue],
      [QUEUE_NAMES.ENRICH, this.enrichQueue],
      [QUEUE_NAMES.SCORE, this.scoreQueue],
      [QUEUE_NAMES.PERSONALIZE, this.personalizeQueue],
      [QUEUE_NAMES.OUTREACH, this.outreachQueue],
    ]);

    const queue = queueMap.get(name);
    if (!queue) {
      throw new Error(`Unknown queue name: ${name}`);
    }
    return queue;
  }
}
