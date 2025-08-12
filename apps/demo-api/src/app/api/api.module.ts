import { Module } from '@nestjs/common';
import { DemoApiStripeModule } from './stripe/stripe.module';
import { DemoApiZoomModule } from './zoom/zoom.module';
import { DemoApiVapiAiModule } from './vapiai';
import { DemoApiOpenAIModule } from './openai';
import { DemoApiTypeformModule } from './typeform';

@Module({
  imports: [
    // Stripe Module
    DemoApiStripeModule,
    DemoApiZoomModule,
    DemoApiVapiAiModule,
    DemoApiOpenAIModule,
    DemoApiTypeformModule
  ],
  exports: []
})
export class DemoApiApiModule {}
