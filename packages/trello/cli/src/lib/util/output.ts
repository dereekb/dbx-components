import { type CliErrorOutput, type CliSecretPattern, DEFAULT_CLI_SECRET_PATTERNS, appendCliErrorMapper, configureCliSecretPatterns, getCliOutputWriter, outputResult, sanitizeString } from '@dereekb/dbx-cli';
import { type LogTrelloServerErrorFunction } from '@dereekb/trello';
import { type Maybe } from '@dereekb/util';
import { TRELLO_CLI_NAME } from '../config/cli.config';

/**
 * The secret-shaped substrings trello-cli redacts from its output, on top of dbx-cli's defaults (`Bearer …`,
 * `access_token=…`, …): the two halves of Trello's `Authorization: OAuth oauth_consumer_key="…", oauth_token="…"`
 * header, and the `key=` / `token=` query parameters of the legacy url auth.
 */
export const TRELLO_CLI_SECRET_PATTERNS: readonly CliSecretPattern[] = [/oauth_consumer_key\s*=\s*"?[^",\s]+"?/gi, /oauth_token\s*=\s*"?[^",\s]+"?/gi, /\bkey=[^&\s"',]+/gi, /\btoken=[^&\s"',]+/gi];

/**
 * The page to check when Trello answers a server-side failure.
 */
export const TRELLO_CLI_SERVICE_STATUS_URL = 'https://trello.status.atlassian.com';

/**
 * The structural shape of a `@dereekb/trello` server error, as {@link isTrelloServerErrorLike} recognizes it.
 */
export interface TrelloServerErrorLike {
  readonly message: string;
  readonly status: number;
  readonly data: {
    readonly status: number;
    readonly bodyText: string;
    readonly bodyJson?: unknown;
  };
}

/**
 * Whether a thrown value is a `@dereekb/trello` server error (a `TrelloServerError` or one of its subclasses).
 *
 * Duck-typed on purpose: a plugin, or a host CLI, can carry its own copy of `@dereekb/trello`, whose error classes are
 * not the ones this CLI's `instanceof` would check. Every copy's errors share this shape.
 *
 * @param error - The thrown value.
 * @returns True for a Trello server error from any copy of the library.
 */
export function isTrelloServerErrorLike(error: unknown): error is TrelloServerErrorLike {
  const candidate = error as Maybe<Partial<TrelloServerErrorLike>>;
  return candidate != null && typeof candidate === 'object' && typeof candidate.status === 'number' && candidate.data != null && typeof candidate.data === 'object' && typeof candidate.data.bodyText === 'string';
}

/**
 * Whether a thrown value is a non-Trello fetch failure carrying an HTTP response (`FetchResponseError`).
 *
 * @param error - The thrown value.
 * @returns The HTTP status, or undefined.
 */
function fetchResponseErrorStatus(error: unknown): Maybe<number> {
  const response = (error as Maybe<{ readonly response?: Maybe<{ readonly status?: unknown }> }>)?.response;
  return response != null && typeof response.status === 'number' ? response.status : undefined;
}

/**
 * Whether an error is a request timeout or abort.
 *
 * @param error - The thrown value.
 * @returns True for an abort or timeout.
 */
export function isTrelloCliTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError' || error.name === 'FetchTimeoutError');
}

/**
 * Reads Trello's own error code from a JSON error body (`{ "message": "…", "error": "ERROR_CODE" }`), when it sent one.
 *
 * @param bodyJson - The parsed body.
 * @returns The code, or undefined.
 */
function trelloServerCode(bodyJson: unknown): Maybe<string> {
  const code = (bodyJson as Maybe<{ readonly error?: unknown; readonly code?: unknown }>)?.error ?? (bodyJson as Maybe<{ readonly code?: unknown }>)?.code;
  return typeof code === 'string' && code.length > 0 ? code : undefined;
}

/**
 * Maps a Trello server error to the CLI error envelope.
 *
 * - 401: `TOKEN_REJECTED`. A token-source token was already cleared, so a re-run mints a fresh one.
 * - 403: `SCOPE_DENIED`. The credentials cannot read or write that board / card.
 * - 404: `NOT_FOUND`.
 * - 429: `RATE_LIMITED`.
 * - 5xx: `SERVICE_UNAVAILABLE`.
 * - anything else: `API_ERROR`.
 *
 * A non-Trello fetch error with a 404 / 5xx maps to `NOT_FOUND` / `SERVICE_UNAVAILABLE`, and a timeout or abort to
 * `TIMEOUT`. Other errors return undefined so the default mapping applies.
 *
 * @param error - The thrown value.
 * @returns The envelope, or undefined when the error is not one trello-cli maps.
 */
export function trelloCliErrorOutput(error: unknown): Maybe<CliErrorOutput> {
  let result: Maybe<CliErrorOutput>;

  if (isTrelloServerErrorLike(error)) {
    const status = error.status;
    const serverCode = trelloServerCode(error.data.bodyJson);
    const base = { ok: false as const, error: sanitizeString(error.message || `Trello request failed with status ${status}`), ...(serverCode ? { serverCode } : {}), httpStatus: status };

    if (status === 401) {
      result = { ...base, code: 'TOKEN_REJECTED', suggestion: `Trello rejected the credentials. Check them with: ${TRELLO_CLI_NAME} auth show. A token-source token was cleared, so a re-run mints a new one.` };
    } else if (status === 403) {
      result = { ...base, code: 'SCOPE_DENIED', suggestion: 'The credentials may not read or change this board or card. Check the member has access to the board and the token was granted write scope for a write.' };
    } else if (status === 404) {
      result = { ...base, code: 'NOT_FOUND', suggestion: 'Check the id, shortLink or link. A card, list or board the credentials cannot see also answers 404.' };
    } else if (status === 429) {
      result = { ...base, code: 'RATE_LIMITED', suggestion: 'Trello throttled the request. Wait and retry.' };
    } else if (status >= 500) {
      result = { ...base, code: 'SERVICE_UNAVAILABLE', suggestion: `Trello's service failed, not the request. Check ${TRELLO_CLI_SERVICE_STATUS_URL} and retry later.` };
    } else {
      result = { ...base, code: 'API_ERROR' };
    }
  } else {
    const httpStatus = fetchResponseErrorStatus(error);

    if (httpStatus === 404) {
      result = { ok: false, error: sanitizeString((error as Error).message), code: 'NOT_FOUND', httpStatus };
    } else if (httpStatus != null && httpStatus >= 500) {
      result = { ok: false, error: sanitizeString((error as Error).message), code: 'SERVICE_UNAVAILABLE', httpStatus, suggestion: `Check ${TRELLO_CLI_SERVICE_STATUS_URL} and retry later.` };
    } else if (isTrelloCliTimeoutError(error)) {
      result = { ok: false, error: sanitizeString((error as Error).message), code: 'TIMEOUT', suggestion: `Trello did not answer in time. Retry; if it keeps timing out, check ${TRELLO_CLI_SERVICE_STATUS_URL}.` };
    }
  }

  return result;
}

/**
 * A Trello error logger for the CLI: one line to stderr per failed request, and only under `--verbose`, since the JSON
 * envelope on stdout already reports the error. Never writes to stdout.
 *
 * @param verbose - Whether to log at all.
 * @returns The logger to pass to `trelloFactory`.
 */
export function trelloCliStderrLogger(verbose: boolean): LogTrelloServerErrorFunction {
  return (error) => {
    if (verbose) {
      const status = (error as Maybe<{ readonly status?: unknown }>)?.status;
      const statusText = typeof status === 'number' ? ` (${status})` : '';
      process.stderr.write(`${TRELLO_CLI_NAME}: Trello error${statusText}: ${sanitizeString(error.message)}\n`);
    }
  };
}

/**
 * Prints a result as the `{ ok: true, data }` envelope, applying `--pick` and carrying plugin warnings in `meta.warnings`.
 *
 * @param data - The result.
 * @param meta - Optional envelope meta.
 */
export function outputTrelloCliResult(data: unknown, meta?: Maybe<Record<string, unknown>>): void {
  outputResult(data, meta ?? undefined);
}

/**
 * Prints each item as one JSON line (NDJSON), bypassing the envelope, through the configured output writer.
 *
 * @param items - The items to print.
 */
export function outputTrelloCliNdjson(items: Iterable<unknown>): void {
  const write = getCliOutputWriter();

  for (const item of items) {
    write(JSON.stringify(item));
  }
}

let trelloCliOutputConfigured = false;

/**
 * Registers trello-cli's output behaviour with `@dereekb/dbx-cli`: the Trello secret patterns and the
 * {@link trelloCliErrorOutput} error mapper. Safe to call more than once.
 *
 * An explicit call rather than an import side effect: the package is `"sideEffects": false`, so a bundler drops a bare
 * side-effect import and the built binary would ship without either.
 */
export function configureTrelloCliOutput(): void {
  if (!trelloCliOutputConfigured) {
    trelloCliOutputConfigured = true;
    configureCliSecretPatterns([...DEFAULT_CLI_SECRET_PATTERNS, ...TRELLO_CLI_SECRET_PATTERNS]);
    appendCliErrorMapper(trelloCliErrorOutput);
  }
}
