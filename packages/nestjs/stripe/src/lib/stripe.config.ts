import type Stripe from 'stripe';

export interface StripeServiceApiConfig {
  readonly secret: string;
  readonly webhookSecret: string;
  readonly config: Stripe.StripeConfig;
}

/**
 * Configuration for StripeService
 */
export abstract class StripeServiceConfig {
  readonly stripe!: StripeServiceApiConfig;

  static assertValidConfig(config: StripeServiceConfig) {
    if (!config.stripe.secret) {
      throw new Error('No stripe secret specified.');
    } else if (!config.stripe.webhookSecret) {
      throw new Error('No stripe webhook secret specified.');
    }
  }
}
