import { createHmac, timingSafeEqual } from 'crypto';
import { type Request } from 'express';
import { type Maybe } from '@dereekb/util';
import { type ZohoSignWebhookEvent, type ZohoSignWebhookPayload, zohoSignWebhookEvent } from './webhook.zoho.sign';

/**
 * Header name used by Zoho Sign to send the HMAC signature.
 */
export const ZOHO_SIGN_WEBHOOK_SIGNATURE_HEADER = 'x-zs-webhook-signature';

export interface ZohoSignWebhookVerificationConfig {
  /**
   * Secret key configured in Zoho Sign webhook settings.
   */
  readonly secret: string;
}

export type ZohoSignWebhookEventVerificationResult = ZohoSignWebhookEventVerificationSuccessResult | ZohoSignWebhookEventVerificationErrorResult;

export interface ZohoSignWebhookEventVerificationSuccessResult {
  readonly valid: true;
  readonly event: ZohoSignWebhookEvent;
}

export interface ZohoSignWebhookEventVerificationErrorResult {
  readonly valid: false;
}

/**
 * Function that verifies a Zoho Sign webhook event.
 */
export type ZohoSignWebhookEventVerifier = (req: Request, rawBody: Buffer) => Promise<ZohoSignWebhookEventVerificationResult>;

/**
 * Creates a verifier for Zoho Sign webhook events using HMAC-SHA256 signature verification.
 *
 * Zoho Sign computes `base64(HMAC-SHA256(payload, secret))` and sends the result
 * in the `X-ZS-WEBHOOK-SIGNATURE` header. This verifier recomputes the signature
 * from the raw request body and compares using timing-safe equality.
 *
 * @param config - Configuration containing the webhook secret key
 * @returns A function that verifies webhook requests
 *
 * @example
 * ```typescript
 * const verifier = zohoSignWebhookEventVerifier({ secret: 'my-secret-key' });
 * const result = await verifier(req, rawBody);
 *
 * if (result.valid) {
 *   console.log(result.event.operationType);
 * }
 * ```
 */
export function zohoSignWebhookEventVerifier(config: ZohoSignWebhookVerificationConfig): ZohoSignWebhookEventVerifier {
  const { secret } = config;

  return async (request: Request, rawBody: Buffer) => {
    const receivedSignature = request.headers[ZOHO_SIGN_WEBHOOK_SIGNATURE_HEADER] as Maybe<string>;

    if (!receivedSignature) {
      return { valid: false };
    }

    const payloadString = rawBody.toString('utf-8');

    // Compute HMAC-SHA256 and base64 encode
    const computedSignature = createHmac('sha256', secret).update(payloadString, 'utf-8').digest('base64');

    // Use timing-safe comparison
    let valid = false;

    try {
      const receivedBuffer = Buffer.from(receivedSignature, 'base64');
      const computedBuffer = Buffer.from(computedSignature, 'base64');

      if (receivedBuffer.length === computedBuffer.length) {
        valid = timingSafeEqual(receivedBuffer, computedBuffer);
      }
    } catch {
      valid = false;
    }

    let event: Maybe<ZohoSignWebhookEvent>;

    if (valid) {
      try {
        const payload: ZohoSignWebhookPayload = JSON.parse(payloadString);
        event = zohoSignWebhookEvent(payload);
      } catch {
        valid = false;
      }
    }

    if (valid && event) {
      return { valid: true, event };
    }

    return { valid: false };
  };
}
