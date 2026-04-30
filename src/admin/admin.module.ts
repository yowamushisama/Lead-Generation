import { Module } from '@nestjs/common';
import { LinkedInRunsController } from './linkedin-runs.controller';

@Module({
  controllers: [LinkedInRunsController],
})
export class AdminModule {}
