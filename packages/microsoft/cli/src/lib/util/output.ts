import { type CliErrorOutput, DEFAULT_CLI_SECRET_PATTERNS, appendCliErrorMapper, configureCliSecretPatterns, sanitizeString } from '@dereekb/dbx-cli';
import { MicrosoftGraphError } from '@dereekb/microsoft';
import { MSGRAPH_CLI_NAME } from '../config/cli.config';

/**
 * Matches a JWT, the shape of a Microsoft access token, wherever it appears (not only after `Bearer`).
 */
export const MSGRAPH_CLI_JWT_SECRET_PATTERN = /eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]+/g;

/**
 * Maps a {@link MicrosoftGraphError} to the CLI error envelope, with a suggestion for the statuses a
 * user can act on. Other errors return undefined so the default mapping applies.
 *
 * - 401: the token was rejected. The command handler has already cleared the cached token, so a re-run mints a new one.
 * - 403: the token lacks a scope the call needs — mint from a connection whose preset grants it.
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
        result = {
          ok: false,
          error: message,
          code: 'SCOPE_DENIED',
          suggestion: `The token lacks a scope this call needs. Use a token source whose connection was granted it (e.g. one connected with the Read + Write preset rather than Read) and whose app login allows minting it; a scope outside every preset cannot be minted. Compare the token's scopes with: ${MSGRAPH_CLI_NAME} auth show`
        };
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

let msGraphCliOutputConfigured = false;

/**
 * Registers msgraph-cli's output behaviour with `@dereekb/dbx-cli`: the bare-JWT secret pattern and
 * the {@link msGraphCliErrorOutput} Graph error mapper. Safe to call more than once.
 *
 * An explicit call rather than an import side effect: the package is `"sideEffects": false`, so a
 * bundler drops a bare `import './lib/util/output'` and the built binary would ship without either.
 */
export function configureMsGraphCliOutput(): void {
  if (!msGraphCliOutputConfigured) {
    msGraphCliOutputConfigured = true;
    // The defaults already redact `Bearer <token>`; add a bare JWT so a token echoed in an error body is redacted too.
    configureCliSecretPatterns([...DEFAULT_CLI_SECRET_PATTERNS, MSGRAPH_CLI_JWT_SECRET_PATTERN]);
    appendCliErrorMapper(msGraphCliErrorOutput);
  }
}
