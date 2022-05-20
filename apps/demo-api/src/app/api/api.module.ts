import { Module } from '@nestjs/common';
import { DemoApiStripeModule } from './stripe/stripe.module';

@Module({
  imports: [DemoApiStripeModule],
  exports: []
})
export class DemoApiApiModule { }
