import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { OrchestratorService } from './orchestrator.service';
import { QUEUE_NAMES } from '../common/constants/queue-names';
import { AIModule } from '../ai/ai.module';
import { ScoringModule } from '../scoring/scoring.module';
import { DatabaseModule } from '../database/database.module';
import { PromptConfigModule } from '../prompt-config/prompt-config.module';
// Stages
import { IntentDetectorStage } from './stages/intent-detector.stage';
import { ICPEnricherStage } from './stages/icp-enricher.stage';
import { LeadScorerStage } from './stages/lead-scorer.stage';
import { PersonalizerStage } from './stages/personalizer.stage';
import { OutreachGeneratorStage } from './stages/outreach-generator.stage';
import { ConversationAssistantStage } from './stages/conversation-assistant.stage';
import { ICPRefinerStage } from './stages/icp-refiner.stage';
// Processors
import { IntentProcessor } from './processors/intent.processor';
import { EnrichmentProcessor } from './processors/enrichment.processor';
import { ScoringProcessor } from './processors/scoring.processor';
import { PersonalizationProcessor } from './processors/personalization.processor';
import { OutreachProcessor } from './processors/outreach.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');

        if (redisUrl) {
          return {
            connection: {
              url: redisUrl,
              maxRetriesPerRequest: 3,
            },
          };
        }

        return {
          connection: {
            host: configService.get<string>('REDIS_HOST') ?? 'localhost',
            port: parseInt(configService.get<string>('REDIS_PORT') ?? '6379', 10),
            password: configService.get<string>('REDIS_PASSWORD'),
            maxRetriesPerRequest: 3,
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.INTENT },
      { name: QUEUE_NAMES.ENRICH },
      { name: QUEUE_NAMES.SCORE },
      { name: QUEUE_NAMES.PERSONALIZE },
      { name: QUEUE_NAMES.OUTREACH },
    ),
    AIModule,
    ScoringModule,
    DatabaseModule,
    PromptConfigModule,
  ],
  providers: [
    OrchestratorService,
    // Stages
    IntentDetectorStage,
    ICPEnricherStage,
    LeadScorerStage,
    PersonalizerStage,
    OutreachGeneratorStage,
    ConversationAssistantStage,
    ICPRefinerStage,
    // Processors
    IntentProcessor,
    EnrichmentProcessor,
    ScoringProcessor,
    PersonalizationProcessor,
    OutreachProcessor,
  ],
  exports: [
    OrchestratorService,
    BullModule,
    IntentDetectorStage,
    ICPEnricherStage,
    LeadScorerStage,
    PersonalizerStage,
    OutreachGeneratorStage,
    ConversationAssistantStage,
    ICPRefinerStage,
  ],
})
export class PipelineModule {}
