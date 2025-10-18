import { type ZoomSecretToken } from '@dereekb/zoom';
import { type ZoomWebhookUrlValidationEvent, type ZoomWebhookUrlValidationPlainTokenString, type ZoomWebhookUrlValidationEncryptedTokenString } from './webhook.zoom.type.validate';
import { createHmac } from 'crypto';

export interface ZoomWebhookValidationResponse {
  readonly plainToken: ZoomWebhookUrlValidationPlainTokenString;
  readonly encryptedToken: ZoomWebhookUrlValidationEncryptedTokenString;
}

/**
 * Function used to create a ZoomWebhookValidationResponse from a ZoomWebhookUrlValidationEvent.
 */
export type ZoomWebhookEventValidationFunction = (event: ZoomWebhookUrlValidationEvent) => ZoomWebhookValidationResponse;

/**
 * Creates a ZoomWebhookEventValidationFunction.
 *
 * @param zoomSecretToken The secret token used to validate the event.
 * @returns A ZoomWebhookEventValidationFunction.
 */
export function zoomWebhookEventValidationFunction(zoomSecretToken: ZoomSecretToken): ZoomWebhookEventValidationFunction {
  return (event: ZoomWebhookUrlValidationEvent) => {
    const { plainToken } = event.payload;

    if (!plainToken) {
      throw new Error(`The expected plaintoken value was not provided by the event's payload.`);
    }

    const encryptedToken = createHmac('sha256', zoomSecretToken).update(plainToken).digest('hex');
    const result: ZoomWebhookValidationResponse = {
      plainToken,
      encryptedToken
    };

    return result;
  };
}
