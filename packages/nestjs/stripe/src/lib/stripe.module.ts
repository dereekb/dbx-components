import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as stripe from 'stripe';
import { StripeApi } from './stripe.api';
import { StripeServiceConfig } from './stripe.config';

export const STRIPE_DEFAULT_API_VERSION: stripe.Stripe.LatestApiVersion = '2020-08-27';

export function stripeServiceConfigFactory(configService: ConfigService): StripeServiceConfig {
  const config: StripeServiceConfig = {
    stripe: {
      secret: configService.get<string>('STRIPE_SECRET') as string,
      webhookSecret: configService.get<string>('STRIPE_WEBHOOK_SECRET') as string,
      config: {
        apiVersion: STRIPE_DEFAULT_API_VERSION
      }
    }
  };

  StripeServiceConfig.assertValidConfig(config);
  return config;
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: StripeServiceConfig,
      inject: [ConfigService],
      useFactory: stripeServiceConfigFactory
    },
    StripeApi
  ],
  exports: [StripeApi]
})
export class StripeModule {}
