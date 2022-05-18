import Stripe from 'stripe';

export interface StripeServiceApiConfig {
  secret: string;
  webhookSecret: string;
  config: Stripe.StripeConfig;
}

/**
 * Configuration for StripeService
 */
export class StripeServiceConfig {

  stripe!: StripeServiceApiConfig;

  static assertValidConfig(config: StripeServiceConfig) {
    if (!config.stripe.secret) {
      throw new Error('No stripe secret specified.');
    } else if (!config.stripe.webhookSecret) {
      throw new Error('No stripe webhook secret specified.');
    }
  }

}
