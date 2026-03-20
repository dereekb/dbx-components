import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { type Stripe } from 'stripe';
import { StripeApi } from './stripe.api';
import { StripeServiceConfig } from './stripe.config';

export const STRIPE_DEFAULT_API_VERSION: Stripe.LatestApiVersion = '2020-08-27';

/**
 * Factory that creates a StripeServiceConfig from environment variables.
 *
 * Reads STRIPE_SECRET and STRIPE_WEBHOOK_SECRET from environment variables using the default API version.
 *
 * @param configService - NestJS config service for reading environment variables
 * @returns a validated StripeServiceConfig
 */
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

/**
 * NestJS module that provides the StripeApi service.
 *
 * Reads Stripe API credentials and webhook secret from environment variables.
 */
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
