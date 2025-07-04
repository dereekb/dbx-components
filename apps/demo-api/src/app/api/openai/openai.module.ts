import { Module } from '@nestjs/common';
import { OpenAIModule, OpenAIWebhookModule } from '@dereekb/nestjs/openai';
import { DemoOpenAiService } from './openai.service';
import { DemoApiOpenAiWebhookService } from './openai.webhook.service';

@Module({
  imports: [OpenAIModule, OpenAIWebhookModule],
  providers: [DemoOpenAiService, DemoApiOpenAiWebhookService],
  exports: [DemoOpenAiService, DemoApiOpenAiWebhookService]
})
export class DemoApiOpenAIModule {}
