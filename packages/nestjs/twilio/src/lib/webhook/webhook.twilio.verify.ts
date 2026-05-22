import { type Maybe } from '@dereekb/util';
import { type Request } from 'express';
import { validateRequest } from 'twilio';

export interface TwilioWebhookVerificationConfig {
  /**
   * Twilio auth token used for HMAC-SHA1 signature verification.
   */
  readonly authToken: string;
  /**
   * Override base URL Twilio used when calculating the signature. Required when the
   * service is behind a proxy and the request's `Host` header does not match the public URL.
   */
  readonly baseUrl?: Maybe<string>;
  /**
   * When true, skip verification and always return valid. Intended for local development.
   */
  readonly skip?: Maybe<boolean>;
}

export interface TwilioWebhookVerificationResult {
  readonly valid: boolean;
  /**
   * Parsed form params from the request body. Always present even when verification fails.
   */
  readonly params: Record<string, string>;
}

export type TwilioWebhookVerifier = (req: Request, rawBody: Buffer) => TwilioWebhookVerificationResult;

/**
 * Parses a `application/x-www-form-urlencoded` raw body into a plain `Record<string, string>`.
 *
 * Twilio's status callback and incoming-message webhooks use this content type by default.
 *
 * @param rawBody - The unparsed request body bytes.
 * @returns Form parameters as a flat string-keyed object.
 */
export function parseTwilioFormBody(rawBody: Buffer): Record<string, string> {
  const params = new URLSearchParams(rawBody.toString('utf8'));
  const out: Record<string, string> = {};
  params.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/**
 * Builds the full URL Twilio used when computing the request signature. Twilio computes
 * the signature over the URL it called (including query string).
 *
 * @param req - Incoming Express request.
 * @param baseUrl - Optional explicit base URL (used when the server sits behind a proxy
 *   and the request's `Host` header does not match the public URL).
 * @returns The full URL string Twilio would have signed.
 */
export function twilioWebhookRequestUrl(req: Request, baseUrl?: Maybe<string>): string {
  let url: string;

  if (baseUrl) {
    const trimmed = baseUrl.replace(/\/$/, '');
    url = `${trimmed}${req.originalUrl ?? req.url}`;
  } else {
    const protocol = (req.headers['x-forwarded-proto'] as string | undefined) ?? req.protocol;
    const host = (req.headers['x-forwarded-host'] as string | undefined) ?? req.get('host');
    url = `${protocol}://${host}${req.originalUrl ?? req.url}`;
  }

  return url;
}

/**
 * Creates a verifier that validates the `X-Twilio-Signature` header against the request body
 * using Twilio's HMAC-SHA1 signature scheme.
 *
 * @param config - Verification config (auth token, optional baseUrl, optional skip flag).
 * @returns A verifier function that, given a request and raw body, returns the validity
 *   and parsed form params.
 */
export function twilioWebhookVerifier(config: TwilioWebhookVerificationConfig): TwilioWebhookVerifier {
  return (req: Request, rawBody: Buffer) => {
    const params = parseTwilioFormBody(rawBody);

    let valid: boolean;

    if (config.skip === true) {
      valid = true;
    } else {
      const signature = (req.headers['x-twilio-signature'] as string | undefined) ?? '';
      const url = twilioWebhookRequestUrl(req, config.baseUrl);
      valid = validateRequest(config.authToken, signature, url, params);
    }

    const result: TwilioWebhookVerificationResult = {
      valid,
      params
    };

    return result;
  };
}
