import { type Maybe } from '@dereekb/util';
import { type Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { type OpenRouterWebhookSecret } from '../openrouter.type';
import { DEFAULT_OPENROUTER_WEBHOOK_HEADER, DEFAULT_OPENROUTER_WEBHOOK_SCHEME } from './webhook.openrouter.config';

export interface OpenRouterWebhookEventVerificationConfig {
  /**
   * The expected shared secret token.
   */
  readonly secret: OpenRouterWebhookSecret;
  /**
   * The header that carries the secret. Defaults to {@link DEFAULT_OPENROUTER_WEBHOOK_HEADER}.
   */
  readonly header?: Maybe<string>;
  /**
   * The scheme prefix stripped from the header value before comparison (e.g. `Bearer`).
   *
   * Defaults to {@link DEFAULT_OPENROUTER_WEBHOOK_SCHEME}. Set to an empty string or null to
   * compare the raw header value with no prefix stripping.
   */
  readonly scheme?: Maybe<string>;
}

export interface OpenRouterWebhookEventVerificationResult {
  readonly valid: boolean;
}

/**
 * Function that verifies an incoming OpenRouter broadcast webhook request.
 */
export type OpenRouterWebhookEventVerifier = (req: Request) => OpenRouterWebhookEventVerificationResult;

/**
 * Constant-time comparison of two secret tokens.
 *
 * Guards against the length-mismatch exception thrown by `crypto.timingSafeEqual` by
 * returning false up front when lengths differ.
 *
 * @param provided - The token presented on the request.
 * @param expected - The configured expected secret token.
 * @returns True when the tokens are byte-for-byte equal.
 */
export function safeCompareOpenRouterWebhookToken(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');

  let valid = false;

  if (providedBuffer.length === expectedBuffer.length) {
    valid = timingSafeEqual(providedBuffer, expectedBuffer);
  }

  return valid;
}

/**
 * Reads a single header value from the request, normalizing array-valued headers to their first entry.
 *
 * @param req - The incoming request.
 * @param header - The (case-insensitive) header name to read.
 * @returns The header value, or undefined when absent.
 */
export function readOpenRouterWebhookHeader(req: Request, header: string): Maybe<string> {
  const value = req.headers[header.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Strips a scheme prefix (e.g. `Bearer `) from a header value, case-insensitively.
 *
 * @param value - The raw header value.
 * @param scheme - The scheme prefix to strip, or null/empty to leave the value untouched.
 * @returns The token portion of the header value, trimmed.
 */
export function stripOpenRouterWebhookScheme(value: string, scheme: Maybe<string>): string {
  let token = value.trim();

  if (scheme) {
    const prefix = `${scheme.toLowerCase()} `;

    if (token.toLowerCase().startsWith(prefix)) {
      token = token.slice(prefix.length).trim();
    }
  }

  return token;
}

/**
 * Creates a verifier for OpenRouter broadcast webhook requests.
 *
 * OpenRouter broadcast webhooks have no HMAC signature scheme. Authentication is a
 * user-configured custom header (e.g. `Authorization: Bearer <secret>`) sent verbatim on every
 * request. This verifier extracts the configured header, strips the scheme prefix, and compares
 * the token to the expected secret using a constant-time comparison.
 *
 * @param config - Verification config containing the secret, header, and scheme.
 * @returns A verifier function that validates each request's secret token.
 */
export function openRouterWebhookEventVerifier(config: OpenRouterWebhookEventVerificationConfig): OpenRouterWebhookEventVerifier {
  const { secret } = config;
  const header = config.header || DEFAULT_OPENROUTER_WEBHOOK_HEADER;
  const scheme = config.scheme === undefined ? DEFAULT_OPENROUTER_WEBHOOK_SCHEME : config.scheme;

  return (req: Request) => {
    const headerValue = readOpenRouterWebhookHeader(req, header);

    let valid = false;

    if (headerValue) {
      const token = stripOpenRouterWebhookScheme(headerValue, scheme);
      valid = safeCompareOpenRouterWebhookToken(token, secret);
    }

    const result: OpenRouterWebhookEventVerificationResult = {
      valid
    };

    return result;
  };
}
