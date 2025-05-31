import { Module } from '@nestjs/common';
import { DemoApiStripeModule } from './stripe/stripe.module';
import { DemoApiZoomModule } from './zoom/zoom.module';

@Module({
  imports: [
    // Stripe Module
    DemoApiStripeModule,
    DemoApiZoomModule
  ],
  exports: []
})
export class DemoApiApiModule {}
