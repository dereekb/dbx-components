import { type CliErrorOutput, DEFAULT_CLI_SECRET_PATTERNS, buildErrorOutput as defaultBuildErrorOutput, configureCliErrorMapper, configureCliSecretPatterns, sanitizeString } from '@dereekb/dbx-cli';
import { ZohoInvalidAuthorizationError, ZohoInvalidTokenError, ZohoServerFetchResponseError, ZohoTooManyRequestsError } from '@dereekb/zoho';

export { type CliError, type CliErrorOutput, type CliOutput, type CliOutputOptions, type CliSuccessOutput, buildDumpFilePath, configureCliSecretPatterns, configureOutputOptions, dumpTimestamp, getOutputOptions, outputResult, pickFields, sanitizeString } from '@dereekb/dbx-cli';

// Add Zoho's refresh-token shape (`1000.<≥20 alphanum>`) to the secret-redaction list. Defaults
// already cover Bearer tokens, access/refresh tokens, and client secrets.
configureCliSecretPatterns([...DEFAULT_CLI_SECRET_PATTERNS, /1000\.\w{20,}/g]);

/**
 * Maps Zoho exception types to a structured {@link CliErrorOutput} envelope. Falls through to
 * the dbx-cli default mapper for non-Zoho errors.
 */
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

  return defaultBuildErrorOutput(error);
}

// Register the Zoho mapper so dbx-cli's `outputError` produces Zoho-aware envelopes everywhere.
configureCliErrorMapper((error) => {
  if (error instanceof ZohoInvalidTokenError || error instanceof ZohoInvalidAuthorizationError || error instanceof ZohoTooManyRequestsError || error instanceof ZohoServerFetchResponseError) {
    return buildErrorOutput(error);
  }

  return undefined;
});

export function outputError(error: unknown): void {
  console.log(JSON.stringify(buildErrorOutput(error)));
}
