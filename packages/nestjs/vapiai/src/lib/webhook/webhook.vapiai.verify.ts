import { Request } from 'express';
import { VapiAiSecretToken } from '../vapiai.type';
import { UntypedVapiAiWebhookEvent } from './webhook.vapiai';
import { AsyncGetterOrValue, getValueFromGetter } from '@dereekb/util';

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
export function vapiAiWebhookEventVerifier(vapiSecretTokenGetter: AsyncGetterOrValue<VapiAiSecretToken>): VapiAiWebhookEventVerifier {
  return async (request: Request, rawBody: Buffer) => {
    const requestBodyString = String(request.body);
    const vapiSecretTokenValue = await getValueFromGetter(vapiSecretTokenGetter);

    // TODO: ...

    const result: VapiAiWebhookEventVerificationResult = {
      valid: true,
      event: JSON.parse(requestBodyString)
    };

    return result;
  };
}
