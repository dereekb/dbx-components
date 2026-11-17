import { type CliErrorOutput, DEFAULT_CLI_SECRET_PATTERNS, appendCliErrorMapper, buildErrorOutput as defaultBuildErrorOutput, configureCliSecretPatterns, sanitizeString, verboseLog } from '@dereekb/dbx-cli';
import { FetchResponseError } from '@dereekb/util/fetch';
import type { Maybe } from '@dereekb/util';
import { type LogZohoServerErrorFunction, ZOHO_DATA_ARRAY_BLANK_ERROR_CODE, ZohoAccountsAccessTokenError, ZohoAccountsAuthFailureError, ZohoCrmRecordNoContentError, ZohoInternalError, ZohoInvalidAuthorizationError, ZohoInvalidTokenError, ZohoRecruitRecordNoContentError, ZohoServerError, ZohoServerFetchResponseError, ZohoTooManyRequestsError } from '@dereekb/zoho';

// eslint-disable-next-line dereekb-util/no-sister-re-export -- backward-compatible facade so zoho-cli consumers keep the existing output-helper import surface
export { type CliError, type CliErrorOutput, type CliOutput, type CliOutputOptions, type CliSuccessOutput, buildDumpFilePath, configureCliSecretPatterns, configureOutputOptions, dumpTimestamp, getOutputOptions, outputResult, pickFields, sanitizeString } from '@dereekb/dbx-cli';

/**
 * Zoho's refresh-token shape (`1000.<≥20 alphanum>`), added to dbx-cli's secret-redaction list. The defaults already
 * cover Bearer tokens, access/refresh tokens, and client secrets.
 */
export const ZOHO_CLI_SECRET_PATTERNS: readonly RegExp[] = [/1000\.\w{20,}/g];

/**
 * The stable `code` values zoho-cli puts on a Zoho failure's error envelope.
 *
 * | `code` | When |
 * |---|---|
 * | `TOKEN_REJECTED` | Zoho rejected the access token: `ZohoInvalidTokenError`, or an HTTP 401 without a scope code (Desk's `INVALID_OAUTH`, Sign's `9041`). The cached token is cleared before the CLI exits, so a re-run mints a new one. |
 * | `AUTH_ERROR` | Zoho refused the stored login itself: `ZohoInvalidAuthorizationError` (`4834`), `ZohoAccountsAccessTokenError` (`invalid_code` / `invalid_client`), or a failed token refresh (`ZohoAccountsAuthFailureError`). |
 * | `SCOPE_DENIED` | HTTP 403, or a 401 whose server code names a scope (`OAUTH_SCOPE_MISMATCH`). |
 * | `RATE_LIMITED` | `ZohoTooManyRequestsError`, or HTTP 429. |
 * | `NOT_FOUND` | HTTP 404, or a Recruit/CRM record lookup that returned no content. |
 * | `SERVICE_UNAVAILABLE` | `ZohoInternalError`, or HTTP 5xx. |
 * | `TIMEOUT` | The request was aborted or timed out. |
 * | `API_ERROR` | Any other Zoho error (record CRUD errors, `INVALID_QUERY`, other 4xx); `serverCode` carries Zoho's code (e.g. `DUPLICATE_DATA`). |
 *
 * Each envelope also carries `httpStatus` (the failed response's status) and `serverCode` (Zoho's own error code) when known.
 */
export type ZohoCliErrorCode = 'TOKEN_REJECTED' | 'AUTH_ERROR' | 'SCOPE_DENIED' | 'RATE_LIMITED' | 'NOT_FOUND' | 'SERVICE_UNAVAILABLE' | 'TIMEOUT' | 'API_ERROR';

/**
 * A Zoho failure classified by {@link classifyZohoCliError}.
 */
export interface ZohoCliErrorClassification {
  readonly code: ZohoCliErrorCode;
  /**
   * The sanitized message for the envelope's `error` field.
   */
  readonly message: string;
  /**
   * The HTTP status of the failed (non-2xx) response, when the failure came from one.
   */
  readonly httpStatus?: Maybe<number>;
  /**
   * Zoho's own error code (e.g. `INVALID_TOKEN`, `INVALID_OAUTH`, `9041`, `invalid_client`), when it sent one.
   */
  readonly serverCode?: Maybe<string>;
}

/**
 * Options for {@link buildErrorOutput} / {@link outputError}.
 */
export interface ZohoCliErrorOutputOptions {
  /**
   * Whether the failed command's product authenticated through a token source. Picks the `TOKEN_REJECTED` suggestion: a
   * token source points at reconnecting the app's Zoho connection, an own login points at `auth check` / `auth login`.
   */
  readonly tokenSource?: Maybe<boolean>;
}

const TOKEN_REJECTED_TOKEN_SOURCE_SUGGESTION = "Zoho rejected the access token from the token source; the cached token was cleared, so re-run to mint a new one. If it keeps failing, the app's Zoho connection may be expired or revoked: reconnect it in the app, then check the source with: zoho-cli auth token-source show";
const TOKEN_REJECTED_OWN_LOGIN_SUGGESTION = 'Zoho rejected the access token; the cached token was cleared, so re-run to get a new one. If it keeps failing, check the login with: zoho-cli auth check (or log in again: zoho-cli auth login)';
const AUTH_ERROR_SUGGESTION = 'Zoho refused the stored login (refresh token or client). Run: zoho-cli auth check, then zoho-cli auth login. With a token source: zoho-cli auth token-source show';
const SCOPE_DENIED_SUGGESTION = 'The token lacks a scope this call needs. Check the granted scopes with zoho-cli auth check; a token source must use a provider that grants it (e.g. zoho_admin for writes)';
const RATE_LIMITED_SUGGESTION = 'Wait and retry. Zoho rate limit exceeded.';
const NOT_FOUND_SUGGESTION = 'Check the module, record id and path.';
const SERVICE_UNAVAILABLE_SUGGESTION = "Zoho's service failed, not the request. Retry later; see https://status.zoho.com";
const TIMEOUT_SUGGESTION = 'Zoho did not answer in time. Retry.';

/**
 * Whether an error is a request timeout or abort.
 *
 * @param error - The thrown value.
 * @returns True for an abort or timeout.
 */
export function isZohoCliTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError' || error.name === 'FetchTimeoutError');
}

/**
 * Reads the HTTP status of the failed response behind a Zoho error. A 2xx status (Recruit and CRM report some errors in a
 * 200 body) is not a failed response, so it is left out.
 *
 * @param error - The thrown value.
 * @returns The non-2xx status, or undefined.
 */
function zohoCliErrorHttpStatus(error: unknown): Maybe<number> {
  let response: Maybe<Response>;

  if (error instanceof ZohoServerFetchResponseError) {
    response = error.responseError?.response;
  } else if (error instanceof FetchResponseError) {
    response = error.response;
  }

  const status = response?.status;
  return status != null && (status < 200 || status >= 300) ? status : undefined;
}

/**
 * Reads Zoho's own error code from a Zoho error: the parsed `code` (string or numeric, e.g. Sign's `9041`), else the Desk
 * body's `errorCode` (e.g. `INVALID_OAUTH`), else the accounts token endpoint's `error`.
 *
 * @param error - The thrown value.
 * @returns The server code as a string, or undefined.
 */
function zohoCliErrorServerCode(error: unknown): Maybe<string> {
  let code: unknown;

  if (error instanceof ZohoServerError) {
    code = error.code;

    if ((code == null || code === '') && error instanceof ZohoServerFetchResponseError) {
      code = (error.errorResponseData as Maybe<{ readonly errorCode?: unknown }>)?.errorCode ?? (error.data as Maybe<{ readonly errorCode?: unknown }>)?.errorCode;
    }
  } else if (error instanceof ZohoAccountsAccessTokenError) {
    code = error.errorCode;
  }

  const isUsable = (typeof code === 'string' && code.length > 0 && code !== ZOHO_DATA_ARRAY_BLANK_ERROR_CODE) || typeof code === 'number';
  return isUsable ? String(code) : undefined;
}

/**
 * Picks the stable zoho-cli code for a Zoho failure. Error classes are checked first, then the HTTP status, so Desk and Sign
 * (whose invalid-token bodies the library does not classify) are still covered.
 *
 * @param error - The thrown value.
 * @param httpStatus - The failed response's status.
 * @param serverCode - Zoho's own error code.
 * @returns The code, or undefined when the error is not a Zoho failure.
 */
function zohoCliErrorCodeFor(error: unknown, httpStatus: Maybe<number>, serverCode: Maybe<string>): Maybe<ZohoCliErrorCode> {
  const isScopeCode = serverCode != null && /SCOPE/i.test(serverCode);
  let code: Maybe<ZohoCliErrorCode>;

  if (error instanceof ZohoInvalidTokenError) {
    code = 'TOKEN_REJECTED';
  } else if (error instanceof ZohoInvalidAuthorizationError || error instanceof ZohoAccountsAccessTokenError || error instanceof ZohoAccountsAuthFailureError) {
    code = 'AUTH_ERROR';
  } else if (httpStatus === 401 && !isScopeCode) {
    code = 'TOKEN_REJECTED';
  } else if (httpStatus === 403 || (httpStatus === 401 && isScopeCode)) {
    code = 'SCOPE_DENIED';
  } else if (error instanceof ZohoTooManyRequestsError || httpStatus === 429) {
    code = 'RATE_LIMITED';
  } else if (httpStatus === 404 || error instanceof ZohoRecruitRecordNoContentError || error instanceof ZohoCrmRecordNoContentError) {
    code = 'NOT_FOUND';
  } else if (error instanceof ZohoInternalError || (httpStatus != null && httpStatus >= 500)) {
    code = 'SERVICE_UNAVAILABLE';
  } else if (isZohoCliTimeoutError(error)) {
    code = 'TIMEOUT';
  } else if (error instanceof ZohoServerError || error instanceof FetchResponseError) {
    code = 'API_ERROR';
  }

  return code;
}

/**
 * Classifies a thrown value as a Zoho failure. Shared by the envelope mapper ({@link buildErrorOutput}) and the
 * rejected-token check ({@link isZohoCliTokenRejectedError}), so both always agree.
 *
 * @param error - The thrown value.
 * @returns The classification, or undefined when the error is not a Zoho (or Zoho HTTP) failure.
 */
export function classifyZohoCliError(error: unknown): Maybe<ZohoCliErrorClassification> {
  const httpStatus = zohoCliErrorHttpStatus(error);
  const serverCode = zohoCliErrorServerCode(error);
  const code = zohoCliErrorCodeFor(error, httpStatus, serverCode);
  let result: Maybe<ZohoCliErrorClassification>;

  if (code != null) {
    const rawMessage = error instanceof Error ? error.message : '';
    const message = rawMessage ? sanitizeString(rawMessage) : httpStatus != null ? `Zoho request failed with status ${httpStatus}` : 'Zoho request failed';
    result = { code, message, httpStatus, serverCode };
  }

  return result;
}

/**
 * Whether a thrown value is Zoho rejecting the access token (`TOKEN_REJECTED`) — the only code that makes the CLI clear
 * the cached token before exiting.
 *
 * @param error - The thrown value.
 * @returns True when the error classifies as `TOKEN_REJECTED`.
 */
export function isZohoCliTokenRejectedError(error: unknown): boolean {
  return classifyZohoCliError(error)?.code === 'TOKEN_REJECTED';
}

function zohoCliErrorSuggestion(code: ZohoCliErrorCode, options?: Maybe<ZohoCliErrorOutputOptions>): Maybe<string> {
  let suggestion: Maybe<string>;

  switch (code) {
    case 'TOKEN_REJECTED':
      suggestion = options?.tokenSource ? TOKEN_REJECTED_TOKEN_SOURCE_SUGGESTION : TOKEN_REJECTED_OWN_LOGIN_SUGGESTION;
      break;
    case 'AUTH_ERROR':
      suggestion = AUTH_ERROR_SUGGESTION;
      break;
    case 'SCOPE_DENIED':
      suggestion = SCOPE_DENIED_SUGGESTION;
      break;
    case 'RATE_LIMITED':
      suggestion = RATE_LIMITED_SUGGESTION;
      break;
    case 'NOT_FOUND':
      suggestion = NOT_FOUND_SUGGESTION;
      break;
    case 'SERVICE_UNAVAILABLE':
      suggestion = SERVICE_UNAVAILABLE_SUGGESTION;
      break;
    case 'TIMEOUT':
      suggestion = TIMEOUT_SUGGESTION;
      break;
    default:
      suggestion = undefined;
      break;
  }

  return suggestion;
}

/**
 * Builds zoho-cli's envelope for a Zoho failure, or undefined for anything else. Registered with dbx-cli as an error
 * mapper by {@link configureZohoCliOutput}.
 *
 * @param error - The thrown value.
 * @param options - Picks the `TOKEN_REJECTED` suggestion wording.
 * @returns The envelope, or undefined when the error is not a Zoho failure.
 */
export function zohoCliErrorOutput(error: unknown, options?: Maybe<ZohoCliErrorOutputOptions>): Maybe<CliErrorOutput> {
  const classified = classifyZohoCliError(error);
  let result: Maybe<CliErrorOutput>;

  if (classified) {
    const suggestion = zohoCliErrorSuggestion(classified.code, options);

    result = {
      ok: false,
      error: classified.message,
      code: classified.code,
      ...(classified.httpStatus == null ? {} : { httpStatus: classified.httpStatus }),
      ...(classified.serverCode == null ? {} : { serverCode: classified.serverCode }),
      ...(suggestion == null ? {} : { suggestion })
    };
  }

  return result;
}

/**
 * Maps a thrown value to zoho-cli's structured {@link CliErrorOutput} envelope: Zoho failures get a stable
 * {@link ZohoCliErrorCode} with `httpStatus` / `serverCode` and a remediation suggestion; anything else falls through to
 * the dbx-cli default mapper (`CliError` passthrough, else `ERROR`).
 *
 * @param error - The thrown value to translate.
 * @param options - Picks the `TOKEN_REJECTED` suggestion wording (token source vs own login).
 * @returns A structured CLI error output envelope safe to JSON-serialize for stdout.
 */
export function buildErrorOutput(error: unknown, options?: Maybe<ZohoCliErrorOutputOptions>): CliErrorOutput {
  return zohoCliErrorOutput(error, options) ?? defaultBuildErrorOutput(error);
}

/**
 * Prints a Zoho-aware error envelope as a single JSON line to stdout.
 *
 * Used as the CLI's terminal error sink so all command failures emit a parseable, sanitized result regardless of the underlying error type.
 *
 * @param error - The thrown value to serialize via {@link buildErrorOutput}.
 * @param options - Picks the `TOKEN_REJECTED` suggestion wording.
 */
export function outputError(error: unknown, options?: Maybe<ZohoCliErrorOutputOptions>): void {
  console.log(JSON.stringify(buildErrorOutput(error, options)));
}

/**
 * Builds the `logZohoServerErrorFunction` zoho-cli passes to every Zoho factory it creates. The library's default logger
 * `console.log`s a multi-line dump (with the stack) to stdout, which breaks the CLI's single-JSON-line contract; this
 * one writes one sanitized line to stderr through dbx-cli's `verboseLog`, and only under `--verbose`.
 *
 * @param label - The client the error came from, e.g. `recruit` or `accounts`.
 * @returns The logger.
 */
export function zohoCliServerErrorLogger(label: string): LogZohoServerErrorFunction {
  return (error) => {
    const httpStatus = zohoCliErrorHttpStatus(error);
    const serverCode = zohoCliErrorServerCode(error);
    const status = httpStatus == null ? '' : ` ${httpStatus}`;
    const code = serverCode == null ? '' : ` ${serverCode}`;
    const message = error instanceof Error && error.message ? sanitizeString(error.message) : (error as Maybe<{ readonly name?: string }>)?.name ?? 'unknown error';
    verboseLog(`zoho-cli ${label}: Zoho error${status}${code}: ${message}`);
  };
}

let zohoCliOutputConfigured = false;

/**
 * Registers zoho-cli's output behaviour with `@dereekb/dbx-cli`: the Zoho secret patterns and the
 * {@link zohoCliErrorOutput} error mapper. Safe to call more than once.
 *
 * An explicit call rather than an import side effect: the package is `"sideEffects": false`, so a bundler drops a bare
 * side-effect import and the built binary would ship without either.
 */
export function configureZohoCliOutput(): void {
  if (!zohoCliOutputConfigured) {
    zohoCliOutputConfigured = true;
    configureCliSecretPatterns([...DEFAULT_CLI_SECRET_PATTERNS, ...ZOHO_CLI_SECRET_PATTERNS]);
    appendCliErrorMapper((error) => zohoCliErrorOutput(error));
  }
}
