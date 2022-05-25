import { StripeWebhookController } from './webhook.stripe.controller';
import { Module } from '@nestjs/common';
import { StripeModule } from '../stripe.module';
import { StripeWebhookService } from './webhook.stripe.service';


@Module({
  controllers: [StripeWebhookController],
  imports: [StripeModule],
  exports: [StripeModule, StripeWebhookService],
  providers: [StripeWebhookService]
})
export class StripeWebhookModule { }
