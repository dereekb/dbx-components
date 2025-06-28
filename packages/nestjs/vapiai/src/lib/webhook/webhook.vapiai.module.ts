import { VapiAiWebhookController } from './webhook.vapiai.controller';
import { Module } from '@nestjs/common';
import { VapiAiModule } from '../vapiai.module';
import { VapiAiWebhookService } from './webhook.vapiai.service';

@Module({
  controllers: [VapiAiWebhookController],
  imports: [VapiAiModule],
  exports: [VapiAiModule, VapiAiWebhookService],
  providers: [VapiAiWebhookService]
})
export class VapiAiWebhookModule {}
