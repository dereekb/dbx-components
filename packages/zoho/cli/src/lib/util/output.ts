import { type CliErrorOutput, DEFAULT_CLI_SECRET_PATTERNS, buildErrorOutput as defaultBuildErrorOutput, configureCliErrorMapper, configureCliSecretPatterns, sanitizeString } from '@dereekb/dbx-cli';
import { ZohoInvalidAuthorizationError, ZohoInvalidTokenError, ZohoServerFetchResponseError, ZohoTooManyRequestsError } from '@dereekb/zoho';

// eslint-disable-next-line dereekb-util/no-sister-re-export -- backward-compatible facade so zoho-cli consumers keep the existing output-helper import surface
export { type CliError, type CliErrorOutput, type CliOutput, type CliOutputOptions, type CliSuccessOutput, buildDumpFilePath, configureCliSecretPatterns, configureOutputOptions, dumpTimestamp, getOutputOptions, outputResult, pickFields, sanitizeString } from '@dereekb/dbx-cli';

// Add Zoho's refresh-token shape (`1000.<≥20 alphanum>`) to the secret-redaction list. Defaults
// already cover Bearer tokens, access/refresh tokens, and client secrets.
configureCliSecretPatterns([...DEFAULT_CLI_SECRET_PATTERNS, /1000\.\w{20,}/g]);

/**
 * Maps Zoho exception types to a structured {@link CliErrorOutput} envelope. Falls through to
 * the dbx-cli default mapper for non-Zoho errors.
 *
 * @param error - The thrown value to translate; Zoho-typed errors are mapped to stable `code` strings (`TOKEN_EXPIRED`, `AUTH_ERROR`, `RATE_LIMITED`, `API_ERROR`) with user-facing remediation suggestions where applicable.
 * @returns A structured CLI error output envelope safe to JSON-serialize for stdout.
 */
export function buildErrorOutput(error: unknown): CliErrorOutput {
  let result: CliErrorOutput;

  if (error instanceof ZohoInvalidTokenError) {
    result = { ok: false, error: sanitizeString(error.message), code: 'TOKEN_EXPIRED', suggestion: 'Run: zoho-cli auth check' };
  } else if (error instanceof ZohoInvalidAuthorizationError) {
    result = { ok: false, error: sanitizeString(error.message), code: 'AUTH_ERROR', suggestion: 'Check your client ID, secret, and refresh token.' };
  } else if (error instanceof ZohoTooManyRequestsError) {
    result = { ok: false, error: sanitizeString(error.message), code: 'RATE_LIMITED', suggestion: 'Wait and retry. Zoho rate limit exceeded.' };
  } else if (error instanceof ZohoServerFetchResponseError) {
    result = { ok: false, error: sanitizeString(error.message), code: 'API_ERROR' };
  } else {
    result = defaultBuildErrorOutput(error);
  }

  return result;
}

// Register the Zoho mapper so dbx-cli's `outputError` produces Zoho-aware envelopes everywhere.
configureCliErrorMapper((error) => {
  const isZohoError = error instanceof ZohoInvalidTokenError || error instanceof ZohoInvalidAuthorizationError || error instanceof ZohoTooManyRequestsError || error instanceof ZohoServerFetchResponseError;
  return isZohoError ? buildErrorOutput(error) : undefined;
});

/**
 * Prints a Zoho-aware error envelope as a single JSON line to stdout.
 *
 * Used as the CLI's terminal error sink so all command failures emit a parseable, sanitized result regardless of the underlying error type.
 *
 * @param error - The thrown value to serialize via {@link buildErrorOutput}.
 */
export function outputError(error: unknown): void {
  console.log(JSON.stringify(buildErrorOutput(error)));
}
