import { type Request } from 'express';
import { createHmac } from 'crypto';
import { type ZoomSecretToken } from '@dereekb/zoom';
import { type UntypedZoomWebhookEvent } from './webhook.zoom.type.common';

export interface ZoomWebhookEventVerificationResult {
  readonly valid: boolean;
  readonly event: UntypedZoomWebhookEvent;
}

/**
 * Function that verifies a Zoom webhook event.
 */
export type ZoomWebhookEventVerifier = (req: Request, rawBody: Buffer) => ZoomWebhookEventVerificationResult;

/**
 * Verifies a Zoom webhook event header.
 *
 * @see https://developers.zoom.us/docs/api/webhooks/#verify-with-zooms-header
 *
 * @param zoomSecretToken The Zoom secret token.
 * @returns A function that verifies a Zoom webhook event.
 */
export function zoomWebhookEventVerifier(zoomSecretToken: ZoomSecretToken): ZoomWebhookEventVerifier {
  return (request: Request, rawBody: Buffer) => {
    const requestBodyString = String(request.body);
    const message = `v0:${request.headers['x-zm-request-timestamp']}:${requestBodyString}`;
    const hashForVerify = createHmac('sha256', zoomSecretToken).update(message).digest('hex');
    const signature = `v0=${hashForVerify}`;

    const valid = request.headers['x-zm-signature'] === signature;

    const result: ZoomWebhookEventVerificationResult = {
      valid,
      event: JSON.parse(requestBodyString)
    };

    return result;
  };
}
