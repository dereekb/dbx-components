import { type Request } from 'express';
import { type VapiAiWebhookSecretToken, type VapiApiWebhookEventVerificationType } from '../vapiai.type';
import { type RawVapiAiWebhookEvent, type UntypedVapiAiWebhookEvent } from './webhook.vapiai';
import { type Maybe } from '@dereekb/util';
import { createHmac } from 'crypto';

export interface VapiApiWebhookEventVerificationConfig {
  /**
   * Secret token to use for verification.
   *
   * If not defined, defaults to an empty string.
   */
  readonly secret?: VapiAiWebhookSecretToken;
  /**
   * Secret token to use for HMAC verification.
   *
   * If not provided, defaults to secret.
   */
  readonly hmacSecret?: Maybe<VapiAiWebhookSecretToken>;
  /**
   * HMAC signature prefix
   *
   * Should match the prefix configured in the Vapi console
   */
  readonly signaturePrefix?: Maybe<string>;
  /**
   * Explicit verification type.
   *
   * If not provided, defaults to hmac if hmac secret is provided.
   */
  readonly verificationType?: Maybe<VapiApiWebhookEventVerificationType>;
}

export interface VapiAiWebhookEventVerificationResult {
  readonly valid: boolean;
  readonly event: UntypedVapiAiWebhookEvent;
}

/**
 * Function that verifies a VapiAi webhook event.
 */
export type VapiAiWebhookEventVerifier = (req: Request, rawBody: Buffer) => Promise<VapiAiWebhookEventVerificationResult>;

/**
 * Verifies a VapiAi webhook event header.
 *
 * @param vapiSecretTokenGetter The VapiAi secret token. The Vapi client allows for using an AsyncGetterOrValue type, so the verifier supports that as well.
 * @returns A function that verifies a VapiAi webhook event.
 */
export function vapiAiWebhookEventVerifier(config: VapiApiWebhookEventVerificationConfig): VapiAiWebhookEventVerifier {
  const { verificationType: inputVerificationType, secret: inputSecret, hmacSecret: inputHmacSecret, signaturePrefix: inputSignaturePrefix } = config;
  const verificationType = inputVerificationType ?? (inputHmacSecret != null ? 'hmac' : 'secret'); // default to secret always, never default to none
  const secretToken = (verificationType === 'hmac' ? (inputHmacSecret ?? inputSecret) : inputSecret) ?? '';
  const signaturePrefix = inputSignaturePrefix ?? '';

  interface VerifyInput {
    readonly request: Request;
    readonly requestBodyString: string;
  }

  function verifyNone(input: VerifyInput) {
    return true;
  }

  function verifySecret(input: VerifyInput) {
    const { request } = input;
    const headers = request.headers;
    const vapiSecret = headers['x-vapi-secret'];

    const valid = vapiSecret === secretToken;
    return valid;
  }

  function verifyHmac(input: VerifyInput) {
    const { request, requestBodyString } = input;
    const headers = request.headers;
    const timestamp = headers['x-timestamp'];
    const vapiSignature = headers['x-signature'];

    const message = `${timestamp}.${requestBodyString}`;
    const hashForVerify = createHmac('sha256', secretToken).update(message).digest('hex');
    const signature = `${signaturePrefix}${hashForVerify}`;

    const valid = vapiSignature === signature;
    return valid;
  }

  const verify = verificationType === 'hmac' ? verifyHmac : verificationType === 'secret' ? verifySecret : verifyNone;

  return async (request: Request, rawBody: Buffer) => {
    const requestBodyString = String(request.body);
    const valid = verify({ request, requestBodyString });
    const requestBody = JSON.parse(requestBodyString) as RawVapiAiWebhookEvent;

    const result: VapiAiWebhookEventVerificationResult = {
      valid,
      event: requestBody.message
    };

    return result;
  };
}
