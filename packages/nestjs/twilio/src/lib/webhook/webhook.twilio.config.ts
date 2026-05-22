import { type Maybe } from '@dereekb/util';

export const TWILIO_WEBHOOK_AUTH_TOKEN_ENV_VAR = 'TWILIO_WEBHOOK_AUTH_TOKEN';
export const TWILIO_WEBHOOK_BASE_URL_ENV_VAR = 'TWILIO_WEBHOOK_BASE_URL';
export const TWILIO_WEBHOOK_SKIP_VERIFY_ENV_VAR = 'TWILIO_WEBHOOK_SKIP_VERIFY';

export interface TwilioWebhookConfig {
  /**
   * Twilio Auth Token used to verify the X-Twilio-Signature header. When unset, the value
   * configured on {@link TwilioServiceConfig} is used.
   */
  readonly authToken?: Maybe<string>;
  /**
   * Base URL of the deployed webhook (e.g. `https://api.example.com`). Twilio computes the
   * request signature over the full URL it called, so behind a proxy the public URL must be
   * supplied here for verification to succeed.
   */
  readonly baseUrl?: Maybe<string>;
  /**
   * When true, signature verification is skipped. Intended for local development against
   * Twilio's test mode; never enable in production.
   */
  readonly skipVerify?: Maybe<boolean>;
}

/**
 * Configuration for the Twilio webhook controller / service.
 */
export abstract class TwilioWebhookServiceConfig {
  readonly twilioWebhook!: TwilioWebhookConfig;
}
