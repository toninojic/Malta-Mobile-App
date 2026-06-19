import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { AiJobAssistantController } from './ai-job-assistant.controller';
import { AiJobAssistantService } from './ai-job-assistant.service';

@Module({
  imports: [JobsModule],
  controllers: [AiJobAssistantController],
  providers: [AiJobAssistantService],
})
export class AiJobAssistantModule {}
