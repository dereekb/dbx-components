import { type CliErrorOutput, type CliOutputPickApplier, DEFAULT_CLI_SECRET_PATTERNS, appendCliErrorMapper, cliCollectionPickApplier, configureCliSecretPatterns, outputResult, sanitizeString } from '@dereekb/dbx-cli';
import { MicrosoftGraphError, MicrosoftGraphMessageNotDraftError, isMicrosoftGraphAdminConsentScope, isMicrosoftGraphNotFoundError, isMicrosoftGraphServiceError, readMicrosoftGraphRequiredScopesFromErrorMessage } from '@dereekb/microsoft';
import { type Maybe } from '@dereekb/util';
import { FetchResponseError, FetchTimeoutError } from '@dereekb/util/fetch';
import { MSGRAPH_CLI_NAME } from '../config/cli.config';

/**
 * Matches a JWT, the shape of a Microsoft access token, wherever it appears (not only after `Bearer`).
 */
export const MSGRAPH_CLI_JWT_SECRET_PATTERN = /eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]+/g;

/**
 * The page to check when Graph answers a server-side failure.
 */
export const MSGRAPH_CLI_SERVICE_STATUS_URL = 'https://status.cloud.microsoft';

const MSGRAPH_CLI_SERVICE_UNAVAILABLE_SUGGESTION = `Microsoft's service failed, not the request. Check ${MSGRAPH_CLI_SERVICE_STATUS_URL} for an incident and retry later.`;

/**
 * Exchange's code for a mailbox the user may not open (a shared mailbox without Full Access).
 */
export const MSGRAPH_CLI_ACCESS_DENIED_CODE = 'ErrorAccessDenied';

/**
 * Exchange's code for a mailbox address that does not resolve.
 */
export const MSGRAPH_CLI_INVALID_USER_CODE = 'ErrorInvalidUser';

/**
 * Added to `SCOPE_DENIED` when Exchange denied access to a mailbox.
 */
export const MSGRAPH_CLI_SHARED_MAILBOX_DENIED_HINT =
  'For another mailbox (--mailbox), the token also needs the *.Shared scope (Mail.Read.Shared, Mail.ReadWrite.Shared, Mail.Send.Shared) and the user needs an Exchange permission on it (Full Access; Send As or Send on Behalf to send). Probe it with: mail mailboxes check <address>';

/**
 * Builds the `SCOPE_DENIED` suggestion. When Graph's message names the scopes the call needs ("API
 * requires one of '…'"), the suggestion names them too, and says when every one of them needs admin
 * consent, since then no user-consentable preset carries them.
 *
 * @param message - The Graph error message.
 * @returns The suggestion.
 */
export function msGraphCliScopeDeniedSuggestion(message: Maybe<string>): string {
  const required = readMicrosoftGraphRequiredScopesFromErrorMessage(message);
  const compare = `Compare the token's scopes with: ${MSGRAPH_CLI_NAME} auth show`;
  let result: string;

  if (required.length === 0) {
    result = `The token lacks a scope this call needs. Use a token source whose connection was granted it (e.g. one connected with the Read + Write preset rather than Read) and whose app login allows minting it; a scope outside every preset cannot be minted. ${compare}`;
  } else if (required.every(isMicrosoftGraphAdminConsentScope)) {
    result = `This call needs one of: ${required.join(', ')}. Each needs admin consent, so no user-consentable preset (Read, Read + Write) carries it: use a token source whose connection a tenant admin consented with an admin preset. ${compare}`;
  } else {
    result = `This call needs one of: ${required.join(', ')}. Use a token source whose connection was granted one of them (e.g. the Read + Write preset rather than Read). ${compare}`;
  }

  return result;
}

/**
 * Returns whether an error is a request timeout or abort: the client aborts a Graph call after 30 seconds
 * and fetch rejects with an `AbortError` ("This operation was aborted").
 *
 * @param error - The thrown value.
 * @returns True for an abort or timeout.
 */
export function isMsGraphCliTimeoutError(error: unknown): boolean {
  return error instanceof FetchTimeoutError || (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError'));
}

/**
 * Maps a {@link MicrosoftGraphError} to the CLI error envelope, with a suggestion for the statuses a
 * user can act on. Graph's own `error.code` (e.g. `InvalidAuthenticationToken`) is printed as
 * `serverCode`, and the HTTP status as `httpStatus`.
 *
 * - 401: `TOKEN_REJECTED`. The command handler has already cleared the cached token, so a re-run mints a new one.
 * - 403: `SCOPE_DENIED`. The token lacks a scope the call needs; the suggestion names it when Graph does.
 * - 403 `ErrorAccessDenied` adds the shared-mailbox permissions to the `SCOPE_DENIED` suggestion.
 * - 404 / `itemNotFound` / `ErrorItemNotFound` / `ErrorInvalidUser`: `NOT_FOUND`.
 * - 429: `RATE_LIMITED`.
 * - 5xx / `UnknownError`: `SERVICE_UNAVAILABLE` (Microsoft's side failed).
 *
 * A non-Graph error body with a 404 or 5xx status maps to `NOT_FOUND` / `SERVICE_UNAVAILABLE` too, a
 * timeout or abort to `TIMEOUT`, and a `draft update` of a sent message to `NOT_A_DRAFT`. Other errors return undefined so the default mapping applies.
 *
 * @param error - The thrown value.
 * @returns The envelope, or undefined when the error is not one msgraph-cli maps.
 */
export function msGraphCliErrorOutput(error: unknown): CliErrorOutput | undefined {
  let result: CliErrorOutput | undefined;

  if (error instanceof MicrosoftGraphError) {
    const message = sanitizeString(error.message);
    const base = { ok: false as const, error: message, ...(error.code ? { serverCode: error.code } : {}), httpStatus: error.status };

    if (error.status === 401) {
      result = { ...base, code: 'TOKEN_REJECTED', suggestion: `Microsoft rejected the access token; the cached token was cleared, so re-run to mint a new one. If it keeps failing, check the token source: ${MSGRAPH_CLI_NAME} auth show` };
    } else if (error.status === 403) {
      const sharedHint = error.code === MSGRAPH_CLI_ACCESS_DENIED_CODE ? ` ${MSGRAPH_CLI_SHARED_MAILBOX_DENIED_HINT}` : '';
      result = { ...base, code: 'SCOPE_DENIED', suggestion: `${msGraphCliScopeDeniedSuggestion(error.data.message)}${sharedHint}` };
    } else if (error.status === 429) {
      result = { ...base, code: 'RATE_LIMITED', suggestion: 'Microsoft Graph throttled the request. Wait and retry.' };
    } else if (error.code === MSGRAPH_CLI_INVALID_USER_CODE) {
      result = { ...base, code: 'NOT_FOUND', suggestion: 'Check the --mailbox address: Graph found no mailbox for it (or it is not enabled for the REST API).' };
    } else if (isMicrosoftGraphNotFoundError(error)) {
      result = { ...base, code: 'NOT_FOUND', suggestion: 'Check the id or path. A mail id read without immutable ids changes when the message moves to another folder.' };
    } else if (isMicrosoftGraphServiceError(error)) {
      result = { ...base, code: 'SERVICE_UNAVAILABLE', suggestion: MSGRAPH_CLI_SERVICE_UNAVAILABLE_SUGGESTION };
    } else {
      result = { ...base, code: 'API_ERROR' };
    }
  } else if (error instanceof FetchResponseError) {
    const httpStatus = error.response.status;

    if (httpStatus === 404) {
      result = { ok: false, error: sanitizeString(error.message), code: 'NOT_FOUND', httpStatus };
    } else if (httpStatus >= 500) {
      result = { ok: false, error: sanitizeString(error.message), code: 'SERVICE_UNAVAILABLE', httpStatus, suggestion: MSGRAPH_CLI_SERVICE_UNAVAILABLE_SUGGESTION };
    }
  } else if (error instanceof MicrosoftGraphMessageNotDraftError) {
    result = { ok: false, error: error.message, code: 'NOT_A_DRAFT', suggestion: 'The message was already sent. Use mail reply / mail forward to follow up on it.' };
  } else if (isMsGraphCliTimeoutError(error)) {
    result = { ok: false, error: sanitizeString((error as Error).message), code: 'TIMEOUT', suggestion: `Microsoft Graph did not answer within the client timeout. Retry; if it keeps timing out, check ${MSGRAPH_CLI_SERVICE_STATUS_URL}.` };
  }

  return result;
}

/**
 * Applies `--pick` to each item of a Graph collection page (`value[]`), keeping the page's own fields
 * (`@odata.context`, `@odata.nextLink`); a single item or a bare array is picked at the top level.
 */
const msGraphCliPickApplier: CliOutputPickApplier<unknown> = cliCollectionPickApplier('value');

/**
 * Prints a Graph result, applying `--pick` to each item of a collection page (`value[]`).
 *
 * @param data - The Graph result: a collection page, a single item, or an array of items.
 */
export function outputMsGraphCliResult(data: unknown): void {
  outputResult(data, undefined, { applyPick: msGraphCliPickApplier });
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
