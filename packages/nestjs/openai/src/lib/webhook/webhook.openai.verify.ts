import { type Request } from 'express';
import { InvalidWebhookSignatureError, type OpenAI } from 'openai';
import { type OpenAIWebhookSecret } from '../openai.type';
import { type Maybe } from '@dereekb/util';
import { type UnwrapWebhookEvent } from 'openai/resources/webhooks';

export interface OpenAIWebhookEventVerificationConfig {
  /**
   * Secret token to use for verification.
   *
   * If not defined, uses what is configured in the client.
   */
  readonly secret?: OpenAIWebhookSecret;
  /**
   * OpenAI client to use for verification.
   */
  readonly client: OpenAI;
}

export type OpenAIWebhookEventVerificationResult = OpenAIWebhookEventVerificationSuccessResult | OpenAIWebhookEventVerificationErrorResult;

export interface OpenAIWebhookEventVerificationSuccessResult {
  readonly valid: true;
  readonly event: Maybe<UnwrapWebhookEvent>;
}

export interface OpenAIWebhookEventVerificationErrorResult {
  readonly valid: false;
}

/**
 * Function that verifies a OpenAI webhook event.
 */
export type OpenAIWebhookEventVerifier = (req: Request, rawBody: Buffer) => Promise<OpenAIWebhookEventVerificationResult>;

/**
 * Verifies an OpenAI webhook event header using the OpenAI client's built-in signature verification.
 *
 * @param config - The verification config containing the OpenAI webhook secret and client.
 * @returns A function that verifies an OpenAI webhook event.
 */
export function openAIWebhookEventVerifier(config: OpenAIWebhookEventVerificationConfig): OpenAIWebhookEventVerifier {
  const { secret, client } = config;

  return async (request: Request, rawBody: Buffer) => {
    const headers = request.headers;
    const requestBodyString = String(request.body);

    let event: Maybe<UnwrapWebhookEvent>;
    let valid = false;

    try {
      event = await client.webhooks.unwrap(requestBodyString, headers, secret);
      valid = true;
    } catch (e) {
      if (e instanceof InvalidWebhookSignatureError) {
        valid = false;
      } else {
        throw e;
      }
    }

    const result: OpenAIWebhookEventVerificationResult = {
      valid,
      event
    };

    return result;
  };
}
