import { ZohoInvalidTokenError, ZohoServerFetchResponseError, ZohoTooManyRequestsError, ZohoInvalidAuthorizationError } from '@dereekb/zoho';

export interface CliSuccessOutput<T = unknown> {
  readonly ok: true;
  readonly data: T;
  readonly meta?: Record<string, unknown>;
}

export interface CliErrorOutput {
  readonly ok: false;
  readonly error: string;
  readonly code: string;
  readonly suggestion?: string;
}

export type CliOutput<T = unknown> = CliSuccessOutput<T> | CliErrorOutput;

/**
 * Patterns that indicate a string may contain a secret token or credential.
 * Used by {@link sanitizeString} to redact sensitive values from CLI output.
 */
const SECRET_PATTERNS = [/Bearer\s+\S+/gi, /access_token[=:]\s*\S+/gi, /refresh_token[=:]\s*\S+/gi, /client_secret[=:]\s*\S+/gi, /1000\.\w{20,}/g];

function sanitizeString(value: string): string {
  let result = value;

  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }

  return result;
}

export function outputResult<T>(data: T, meta?: Record<string, unknown>): void {
  const output: CliSuccessOutput<T> = { ok: true, data, ...(meta ? { meta } : {}) };
  console.log(JSON.stringify(output));
}

export function outputError(error: unknown): void {
  const output = buildErrorOutput(error);
  console.log(JSON.stringify(output));
}

export function buildErrorOutput(error: unknown): CliErrorOutput {
  if (error instanceof ZohoInvalidTokenError) {
    return { ok: false, error: sanitizeString(error.message), code: 'TOKEN_EXPIRED', suggestion: 'Run: zoho-cli auth check' };
  }

  if (error instanceof ZohoInvalidAuthorizationError) {
    return { ok: false, error: sanitizeString(error.message), code: 'AUTH_ERROR', suggestion: 'Check your client ID, secret, and refresh token.' };
  }

  if (error instanceof ZohoTooManyRequestsError) {
    return { ok: false, error: sanitizeString(error.message), code: 'RATE_LIMITED', suggestion: 'Wait and retry. Zoho rate limit exceeded.' };
  }

  if (error instanceof ZohoServerFetchResponseError) {
    return { ok: false, error: sanitizeString(error.message), code: 'API_ERROR' };
  }

  if (error instanceof Error) {
    return { ok: false, error: sanitizeString(error.message), code: 'ERROR' };
  }

  return { ok: false, error: sanitizeString(String(error)), code: 'UNKNOWN_ERROR' };
}
