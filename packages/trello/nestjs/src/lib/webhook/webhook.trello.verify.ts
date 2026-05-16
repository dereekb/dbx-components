import { createHmac, timingSafeEqual } from 'node:crypto';
import { type Request } from 'express';
import { type TrelloAppSecret } from '@dereekb/trello';
import { type UntypedTrelloWebhookEvent } from './webhook.trello.type';

export interface TrelloWebhookEventVerificationResult {
  readonly valid: boolean;
  /**
   * Parsed event, only present on successful verification.
   */
  readonly event?: UntypedTrelloWebhookEvent;
}

/**
 * Function that verifies a Trello webhook event.
 */
export type TrelloWebhookEventVerifier = (req: Request, rawBody: Buffer) => TrelloWebhookEventVerificationResult;

export interface TrelloWebhookEventVerifierConfig {
  /**
   * App secret from the Power-Up admin page, used to verify the `X-Trello-Webhook` header.
   */
  readonly appSecret: TrelloAppSecret;
  /**
   * The exact callback URL configured for this webhook subscription.
   *
   * Trello signs the HMAC over `rawBody + callbackURL`, so the URL must match exactly (including scheme + path).
   */
  readonly callbackUrl: string;
}

/**
 * Computes the expected `X-Trello-Webhook` value for the given body + callback URL.
 *
 * Exported for testability.
 *
 * @param appSecret The Trello app secret.
 * @param rawBody The raw request body bytes.
 * @param callbackUrl The exact callback URL configured for this webhook.
 * @returns The expected base64 signature value.
 */
export function trelloWebhookExpectedSignature(appSecret: TrelloAppSecret, rawBody: Buffer, callbackUrl: string): string {
  const hmac = createHmac('sha1', appSecret);
  hmac.update(rawBody);
  hmac.update(callbackUrl);
  return hmac.digest('base64');
}

/**
 * Verifies a Trello webhook event header.
 *
 * @see https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/#webhook-signatures
 *
 * @param config The verifier configuration.
 * @returns A function that verifies a Trello webhook event.
 */
export function trelloWebhookEventVerifier(config: TrelloWebhookEventVerifierConfig): TrelloWebhookEventVerifier {
  const { appSecret, callbackUrl } = config;

  return (request: Request, rawBody: Buffer) => {
    const headerValue = request.headers['x-trello-webhook'];
    const signature = typeof headerValue === 'string' ? headerValue : Array.isArray(headerValue) ? headerValue[0] : undefined;

    let valid = false;

    if (signature) {
      const expected = trelloWebhookExpectedSignature(appSecret, rawBody, callbackUrl);
      const expectedBuffer = Buffer.from(expected);
      const signatureBuffer = Buffer.from(signature);

      valid = expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer);
    }

    let event: UntypedTrelloWebhookEvent | undefined;

    if (valid) {
      try {
        event = JSON.parse(rawBody.toString('utf8')) as UntypedTrelloWebhookEvent;
      } catch {
        return { valid: false };
      }
    }

    return { valid, event };
  };
}
