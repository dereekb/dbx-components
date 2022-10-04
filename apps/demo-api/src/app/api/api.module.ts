import { Module } from '@nestjs/common';
import { DemoApiStripeModule } from './stripe/stripe.module';

@Module({
  imports: [
    // Stripe Module
    DemoApiStripeModule
  ],
  exports: []
})
export class DemoApiApiModule {}
