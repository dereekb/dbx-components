import { Module } from '@nestjs/common';
import { VapiAiModule, VapiAiWebhookModule } from '@dereekb/nestjs/vapiai';
import { DemoVapiAiService } from './vapiai.service';
import { DemoApiVapiAiWebhookService } from './vapiai.webhook.service';

@Module({
  imports: [VapiAiModule, VapiAiWebhookModule],
  providers: [DemoVapiAiService, DemoApiVapiAiWebhookService],
  exports: [DemoVapiAiService, DemoApiVapiAiWebhookService]
})
export class DemoApiVapiAiModule {}
