import { type CliErrorOutput, DEFAULT_CLI_SECRET_PATTERNS, appendCliErrorMapper, configureCliSecretPatterns, sanitizeString } from '@dereekb/dbx-cli';
import { MicrosoftGraphError } from '@dereekb/microsoft';
import { MSGRAPH_CLI_NAME } from '../config/cli.config';

/**
 * Matches a JWT, the shape of a Microsoft access token, wherever it appears (not only after `Bearer`).
 */
export const MSGRAPH_CLI_JWT_SECRET_PATTERN = /eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]+/g;

// The defaults already redact `Bearer <token>`; add a bare JWT so a token echoed in an error body is redacted too.
configureCliSecretPatterns([...DEFAULT_CLI_SECRET_PATTERNS, MSGRAPH_CLI_JWT_SECRET_PATTERN]);

/**
 * Maps a {@link MicrosoftGraphError} to the CLI error envelope, with a suggestion for the statuses a
 * user can act on. Other errors return undefined so the default mapping applies.
 *
 * - 401: the token was rejected. The command handler has already cleared the cached token, so a re-run mints a new one.
 * - 403: the token lacks a scope the call needs — widen `--scopes`, or mint from a preset that grants it.
 * - 429: Graph throttled the call.
 *
 * @param error - The thrown value.
 * @returns The envelope, or undefined when the error is not a Graph error.
 */
export function msGraphCliErrorOutput(error: unknown): CliErrorOutput | undefined {
  let result: CliErrorOutput | undefined;

  if (error instanceof MicrosoftGraphError) {
    const message = sanitizeString(error.message);

    switch (error.status) {
      case 401:
        result = { ok: false, error: message, code: 'TOKEN_REJECTED', suggestion: `Microsoft rejected the access token; the cached token was cleared, so re-run to mint a new one. If it keeps failing, check the token source: ${MSGRAPH_CLI_NAME} auth show` };
        break;
      case 403:
        result = { ok: false, error: message, code: 'SCOPE_DENIED', suggestion: `The token lacks a scope this call needs. Re-run with --scopes naming it (e.g. --scopes "Mail.Read"), or mint from an app env preset / connection preset that grants it (Read vs Read + Write). See: ${MSGRAPH_CLI_NAME} auth show` };
        break;
      case 429:
        result = { ok: false, error: message, code: 'RATE_LIMITED', suggestion: 'Microsoft Graph throttled the request. Wait and retry.' };
        break;
      default:
        result = { ok: false, error: message, code: 'API_ERROR' };
        break;
    }
  }

  return result;
}

appendCliErrorMapper(msGraphCliErrorOutput);
