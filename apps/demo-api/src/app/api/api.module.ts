import { Module } from '@nestjs/common';
import { DemoApiStripeModule } from './stripe/stripe.module';
import { DemoApiZoomModule } from './zoom/zoom.module';
import { DemoApiVapiAiModule } from './vapiai';

@Module({
  imports: [
    // Stripe Module
    DemoApiStripeModule,
    DemoApiZoomModule,
    DemoApiVapiAiModule
  ],
  exports: []
})
export class DemoApiApiModule {}
