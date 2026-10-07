import { type Maybe } from '@dereekb/util';

export const TWILIO_WEBHOOK_AUTH_TOKEN_ENV_VAR = 'TWILIO_WEBHOOK_AUTH_TOKEN';
export const TWILIO_WEBHOOK_SKIP_VERIFY_ENV_VAR = 'TWILIO_WEBHOOK_SKIP_VERIFY';

export interface TwilioWebhookConfig {
  /**
   * Twilio Auth Token used to verify the X-Twilio-Signature header. Required.
   *
   * `twilioWebhookServiceConfigFactory()` reads it from `TWILIO_WEBHOOK_AUTH_TOKEN`, falling back to
   * `TWILIO_AUTH_TOKEN`.
   */
  readonly authToken?: Maybe<string>;
  /**
   * Public origin Twilio calls the webhook on (e.g. `https://api.example.com`). Twilio computes the
   * request signature over the full URL it called, so behind a proxy the public origin must be
   * supplied here for verification to succeed. When unset, the URL is rebuilt from the request's
   * `X-Forwarded-Proto` / `X-Forwarded-Host` / `Host` headers.
   *
   * Not read from the environment. Build it from the app's public webhook URL with
   * `twilioWebhookUrls()`.
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
