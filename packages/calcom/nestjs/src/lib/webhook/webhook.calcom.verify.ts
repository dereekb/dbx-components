import { createHmac } from 'crypto';
import { type UntypedCalcomWebhookEvent } from './webhook.calcom.type';

export interface CalcomWebhookEventVerificationResult {
  readonly valid: boolean;
  readonly event: UntypedCalcomWebhookEvent;
}

/**
 * Function that verifies a Cal.com webhook event.
 */
export type CalcomWebhookEventVerifier = (rawBody: Buffer, headers: Record<string, string>) => CalcomWebhookEventVerificationResult;

/**
 * Verifies a Cal.com webhook event using HMAC-SHA256 signature.
 *
 * @param secret The webhook signing secret.
 * @returns A function that verifies a Cal.com webhook event.
 */
export function calcomWebhookEventVerifier(secret: string): CalcomWebhookEventVerifier {
  return (rawBody: Buffer, headers: Record<string, string>) => {
    const rawBodyString = rawBody.toString('utf8');
    const signature = headers['x-cal-signature-256'] ?? '';
    const expectedSignature = createHmac('sha256', secret).update(rawBodyString).digest('hex');

    const valid = signature === expectedSignature;

    let event: UntypedCalcomWebhookEvent;

    try {
      event = JSON.parse(rawBodyString);
    } catch (e) {
      event = { triggerEvent: '', createdAt: '', payload: {} };
    }

    const result: CalcomWebhookEventVerificationResult = {
      valid,
      event
    };

    return result;
  };
}
