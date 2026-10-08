import { type Maybe, type WebsitePath, type WebsiteUrl, websiteUrlFromPaths } from '@dereekb/util';
import { type TwilioStatusCallbackUrl } from '../twilio.type';

/**
 * Path of the {@link TwilioWebhookController} under the app's webhook path (`/webhook`).
 */
export const TWILIO_WEBHOOK_PATH: WebsitePath = '/twilio';

/**
 * Path of the message status callback route under {@link TWILIO_WEBHOOK_PATH}.
 */
export const TWILIO_WEBHOOK_STATUS_PATH: WebsitePath = '/status';

/**
 * Path of the incoming message route under {@link TWILIO_WEBHOOK_PATH}.
 */
export const TWILIO_WEBHOOK_INCOMING_PATH: WebsitePath = '/incoming';

/**
 * Public URLs of the {@link TwilioWebhookController} routes.
 */
export interface TwilioWebhookUrls {
  /**
   * Origin Twilio calls the webhooks on. Use as `TwilioWebhookConfig.baseUrl`.
   */
  readonly baseUrl: WebsiteUrl;
  /**
   * URL Twilio posts message status updates to. Use as `TwilioMessagesConfig.defaultStatusCallback`.
   */
  readonly statusCallbackUrl: TwilioStatusCallbackUrl;
  /**
   * URL Twilio posts incoming messages to. Set it as the phone number's "A message comes in" webhook in the Twilio Console.
   */
  readonly incomingMessageUrl: WebsiteUrl;
}

/**
 * Builds the public URLs of the {@link TwilioWebhookController} routes from the app's public webhook URL.
 *
 * The `baseUrl` is the origin of the webhook URL, since the verifier appends the request's full path to it.
 * This assumes requests reach the app with their public path intact, as they do through a Firebase Hosting
 * rewrite.
 *
 * @param webhookUrl - Public URL the app's `/webhook` routes are served at, e.g. `https://app.example.com/api/webhook`.
 * @returns The Twilio webhook URLs.
 */
export function twilioWebhookUrls(webhookUrl: WebsiteUrl): TwilioWebhookUrls {
  return {
    baseUrl: new URL(webhookUrl).origin,
    statusCallbackUrl: websiteUrlFromPaths(webhookUrl, [TWILIO_WEBHOOK_PATH, TWILIO_WEBHOOK_STATUS_PATH]),
    incomingMessageUrl: websiteUrlFromPaths(webhookUrl, [TWILIO_WEBHOOK_PATH, TWILIO_WEBHOOK_INCOMING_PATH])
  };
}

/**
 * The app's public Twilio webhook URLs, provided to the Twilio modules through their `dependencyModule`.
 *
 * When a module built by `appTwilioModuleMetadata()` can resolve it, outbound texts request status callbacks at
 * {@link TwilioWebhookUrls.statusCallbackUrl}. When one built by `appTwilioWebhookModuleMetadata()` can, webhook
 * requests are verified against {@link TwilioWebhookUrls.baseUrl}.
 *
 * `twilioWebhookUrlsConfigProvider()` from `@dereekb/firebase-server/twilio` provides it from the server environment.
 */
export abstract class TwilioWebhookUrlsConfig {
  /**
   * The URLs, or undefined when Twilio cannot reach the app's webhooks.
   */
  readonly twilioWebhookUrls?: Maybe<TwilioWebhookUrls>;
}
