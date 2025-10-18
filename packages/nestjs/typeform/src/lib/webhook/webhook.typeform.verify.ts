import { type Request } from 'express';
import { type TypeformWebhookSecretToken } from '../typeform.type';
import { createHmac } from 'crypto';
import { type RawTypeformWebhookEvent } from './webhook.typeform';

export interface TypeformWebhookEventVerificationConfig {
  /**
   * Secret token to use for verification.
   *
   * If not defined, uses what is configured in the client.
   */
  readonly secret: TypeformWebhookSecretToken;
}

export type TypeformWebhookEventVerificationResult = TypeformWebhookEventVerificationSuccessResult | TypeformWebhookEventVerificationErrorResult;

export interface TypeformWebhookEventVerificationSuccessResult {
  readonly valid: true;
  readonly event: RawTypeformWebhookEvent;
}

export interface TypeformWebhookEventVerificationErrorResult {
  readonly valid: false;
}

/**
 * Function that verifies a Typeform webhook event.
 */
export type TypeformWebhookEventVerifier = (req: Request, rawBody: Buffer) => Promise<TypeformWebhookEventVerificationResult>;

/**
 * Verifies a Typeform webhook event header.
 *
 * @param vapiSecretTokenGetter The Typeform secret token. The Vapi client allows for using an AsyncGetterOrValue type, so the verifier supports that as well.
 * @returns A function that verifies a Typeform webhook event.
 */
export function typeFormWebhookEventVerifier(config: TypeformWebhookEventVerificationConfig): TypeformWebhookEventVerifier {
  const { secret } = config;

  return async (request: Request, rawBody: Buffer) => {
    const requestBodyString = String(request.body);

    const headers = request.headers;
    const vapiSignature = headers['typeform-signature'];

    const hashForVerify = createHmac('sha256', secret).update(requestBodyString).digest('base64');
    const signature = `sha256=${hashForVerify}`;

    const valid = vapiSignature === signature;
    const event = JSON.parse(requestBodyString) as RawTypeformWebhookEvent;

    const result: TypeformWebhookEventVerificationResult = {
      valid,
      event
    };

    return result;
  };
}
