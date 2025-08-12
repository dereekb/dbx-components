import { Module } from '@nestjs/common';
import { DemoTypeformService } from './typeform.service';
import { TypeformModule, TypeformWebhookModule } from '@dereekb/nestjs/typeform';
import { DemoApiTypeformWebhookService } from './typeform.webhook.service';

@Module({
  imports: [TypeformModule, TypeformWebhookModule],
  providers: [DemoTypeformService, DemoApiTypeformWebhookService],
  exports: [DemoTypeformService, DemoApiTypeformWebhookService]
})
export class DemoApiTypeformModule {}
