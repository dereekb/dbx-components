import { StripeWebhookModule } from '@dereekb/nestjs/stripe';
import { Module } from '@nestjs/common';
import { DemoApiStripeExampleService } from './demo.stripe.handler';

@Module({
  imports: [StripeWebhookModule],
  providers: [DemoApiStripeExampleService],
  exports: []
})
export class DemoApiStripeModule {}
