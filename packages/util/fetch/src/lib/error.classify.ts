/**
 * Transport-error CLASSIFICATION: how a failed request relates to an identical resend.
 *
 * Every rule here reads the thrown value STRUCTURALLY — its `.name`, its constructor names ({@link errorClassNames}),
 * its HTTP status and its socket codes — so it needs no SDK import and stays browser-safe (no Node import, no
 * `process` read). The classifier only describes the error; whether to resend is the caller's policy, applied with
 * {@link isRetryableFetchErrorClassification}.
 */

import { errorClassNames, type Maybe } from '@dereekb/util';

// MARK: Types
/**
 * How a failed request relates to an identical resend.
 *
 * - `transient`: the failure is about the moment (a dropped socket, a rate limit, a 5xx, a timer that fired) — a
 *   resend can plausibly succeed.
 * - `permanent`: the failure is a fact about the request or the credential (400–404) — a resend arrives at the same
 *   answer.
 * - `unknown`: nothing recognised it — the caller's policy decides.
 */
export type FetchErrorClassification = 'transient' | 'permanent' | 'unknown';

/**
 * A host's call on an error the classifier read as `unknown`: `true` resends / requeues it, `false` refuses it, and
 * no answer leaves the caller's default. Wiring-time code — never stored.
 */
export type IsRetryableUnknownErrorFunction = (error: unknown) => Maybe<boolean>;

// MARK: Defaults
/**
 * The `.name` / class names that mean "the client gave up waiting": the DOMException `AbortError` / `TimeoutError` an
 * `AbortSignal` rejects with, and util/fetch's own `FetchTimeoutError`.
 *
 * @dbxUtil
 * @dbxUtilCategory fetch
 * @dbxUtilTags fetch, error, abort, timeout, abort-error, timeout-error, cancel
 */
export const DEFAULT_FETCH_ABORT_ERROR_NAMES: ReadonlySet<string> = new Set(['AbortError', 'TimeoutError', 'FetchTimeoutError']);

/**
 * The Node / undici socket codes a `fetch` failure carries (on the error or its `cause`) when the far end never
 * answered: refused, reset, unreachable or timed out.
 *
 * A DNS miss (`ENOTFOUND`) is left out: a misspelled host is a fact a resend cannot change. Add it to a custom set to
 * treat it as transient.
 *
 * @dbxUtil
 * @dbxUtilCategory fetch
 * @dbxUtilTags fetch, error, network, socket, econnreset, econnrefused, undici, code
 */
export const DEFAULT_FETCH_NETWORK_ERROR_CODES: ReadonlySet<string> = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE', 'EAI_AGAIN', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT']);

/**
 * The `TypeError` messages a `fetch` rejects with when the request never got an answer, by runtime:
 *
 * | Message | Source |
 * |---|---|
 * | `fetch failed` | Node / undici |
 * | `Failed to fetch` | Chromium |
 * | `NetworkError when attempting to fetch resource.` | Firefox |
 * | `Load failed` | Safari 17+ |
 * | `The Internet connection appears to be offline.` | Safari 16 |
 *
 * CAVEAT: a browser reports a CORS rejection, mixed content or an extension block with the same `Failed to fetch`,
 * and nothing tells them apart by design. Such an error reads as transient; the caller's bounded attempt budget caps
 * the cost.
 *
 * @dbxUtil
 * @dbxUtilCategory fetch
 * @dbxUtilTags fetch, error, network, browser, type-error, offline, failed-to-fetch
 */
export const DEFAULT_FETCH_NETWORK_ERROR_MESSAGES: ReadonlySet<string> = new Set(['fetch failed', 'Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed', 'The Internet connection appears to be offline.']);

/**
 * The HTTP statuses below 500 that are transient: 408 (Request Timeout — the request was never processed, so a resend
 * is safe) and 429 (Too Many Requests). Every status `>= 500` is transient as well.
 *
 * @dbxUtil
 * @dbxUtilCategory fetch
 * @dbxUtilTags fetch, error, http, status, 408, 429, retry, transient
 */
export const DEFAULT_FETCH_TRANSIENT_HTTP_STATUSES: ReadonlySet<number> = new Set([408, 429]);

/**
 * The HTTP statuses that are permanent: 400, 401, 402, 403 and 404 — facts about the request or the credential that a
 * resend cannot change.
 *
 * @dbxUtil
 * @dbxUtilCategory fetch
 * @dbxUtilTags fetch, error, http, status, 400, 401, 403, 404, permanent
 */
export const DEFAULT_FETCH_PERMANENT_HTTP_STATUSES: ReadonlySet<number> = new Set([400, 401, 402, 403, 404]);

// MARK: Config
/**
 * Configures {@link classifyFetchError} and its parts. Each set REPLACES its default when given; spread the exported
 * default to extend it (`new Set([...DEFAULT_FETCH_ABORT_ERROR_NAMES, 'APIUserAbortError'])`).
 */
export interface FetchErrorClassificationConfig {
  /**
   * `.name` / class names that mark an abort or timeout. Defaults to {@link DEFAULT_FETCH_ABORT_ERROR_NAMES}.
   */
  readonly abortErrorNames?: Maybe<ReadonlySet<string>>;
  /**
   * `.name` / class names that are always transient (an SDK's connection or rate-limit class). No default.
   */
  readonly transientClassNames?: Maybe<ReadonlySet<string>>;
  /**
   * `.name` / class names that are always permanent. Outrank every other rule. No default.
   */
  readonly permanentClassNames?: Maybe<ReadonlySet<string>>;
  /**
   * Socket codes that mark a network failure. Defaults to {@link DEFAULT_FETCH_NETWORK_ERROR_CODES}.
   */
  readonly networkErrorCodes?: Maybe<ReadonlySet<string>>;
  /**
   * `TypeError` messages that mark a network failure. Defaults to {@link DEFAULT_FETCH_NETWORK_ERROR_MESSAGES}.
   */
  readonly networkErrorMessages?: Maybe<ReadonlySet<string>>;
  /**
   * Statuses that are transient, besides every status `>= 500`. Defaults to {@link DEFAULT_FETCH_TRANSIENT_HTTP_STATUSES}.
   */
  readonly transientStatuses?: Maybe<ReadonlySet<number>>;
  /**
   * Statuses that are permanent. Outrank the `>= 500` rule. Defaults to {@link DEFAULT_FETCH_PERMANENT_HTTP_STATUSES}.
   */
  readonly permanentStatuses?: Maybe<ReadonlySet<number>>;
  /**
   * Reads the HTTP status off an error object. Defaults to {@link readFetchErrorStatus}.
   */
  readonly readStatus?: Maybe<(error: object) => Maybe<number>>;
}

// MARK: Helpers
/**
 * Whether an error's `.name`, or any constructor name on its prototype chain, is in the set.
 *
 * @param error - The thrown object.
 * @param names - The names to match.
 * @returns `true` on a match.
 */
function errorNameMatches(error: object, names: ReadonlySet<string>): boolean {
  const { name } = error as { readonly name?: unknown };
  return (typeof name === 'string' && names.has(name)) || errorClassNames(error).some((className) => names.has(className));
}

/**
 * Reads the HTTP status off a thrown value: its own numeric `status`, else its `response.status` (util/fetch's
 * `FetchResponseError` and the `{ response }` shape a limited fetch throws).
 *
 * @param error - The thrown value.
 * @returns The status, or `undefined` when neither is a number.
 *
 * @dbxUtil
 * @dbxUtilCategory fetch
 * @dbxUtilTags fetch, error, http, status, response, read
 *
 * @example
 * ```ts
 * readFetchErrorStatus({ status: 429 }); // 429
 * readFetchErrorStatus(new FetchResponseError(new Response(null, { status: 503 }))); // 503
 * readFetchErrorStatus(new Error('boom')); // undefined
 * ```
 */
export function readFetchErrorStatus(error: unknown): Maybe<number> {
  let status: Maybe<number>;

  if (error != null && typeof error === 'object') {
    const { status: ownStatus, response } = error as { readonly status?: unknown; readonly response?: unknown };

    if (typeof ownStatus === 'number') {
      status = ownStatus;
    } else if (response != null && typeof response === 'object') {
      const responseStatus = (response as { readonly status?: unknown }).status;
      status = typeof responseStatus === 'number' ? responseStatus : undefined;
    }
  }

  return status;
}

/**
 * Classifies an HTTP status, in order: a `permanentStatuses` status is `permanent`; a `transientStatuses` status or
 * any status `>= 500` is `transient`; anything else (409, 405, 410, 422, a 2xx with a bad body, a 3xx) is `unknown`.
 *
 * @param status - The HTTP status.
 * @param config - Optional replacement status sets.
 * @returns The classification.
 *
 * @dbxUtil
 * @dbxUtilCategory fetch
 * @dbxUtilTags fetch, error, http, status, classify, retry, transient, permanent
 *
 * @example
 * ```ts
 * classifyFetchErrorStatus(503); // 'transient'
 * classifyFetchErrorStatus(401); // 'permanent'
 * classifyFetchErrorStatus(409); // 'unknown'
 * ```
 */
export function classifyFetchErrorStatus(status: number, config?: Maybe<Pick<FetchErrorClassificationConfig, 'transientStatuses' | 'permanentStatuses'>>): FetchErrorClassification {
  const permanentStatuses = config?.permanentStatuses ?? DEFAULT_FETCH_PERMANENT_HTTP_STATUSES;
  const transientStatuses = config?.transientStatuses ?? DEFAULT_FETCH_TRANSIENT_HTTP_STATUSES;
  let classification: FetchErrorClassification;

  if (permanentStatuses.has(status)) {
    classification = 'permanent';
  } else if (transientStatuses.has(status) || status >= 500) {
    classification = 'transient';
  } else {
    classification = 'unknown';
  }

  return classification;
}

/**
 * Whether a thrown value is an ABORT / timeout error: its `.name`, or a constructor name on its chain, is in
 * `abortErrorNames` (the DOMException `AbortError` / `TimeoutError`, util/fetch's `FetchTimeoutError`, plus any
 * SDK class a caller adds).
 *
 * {@link classifyFetchError} reads an abort as `transient`, because a timer that fired is worth a resend. A caller that
 * cancelled on purpose checks its own signal before resending.
 *
 * @param error - The thrown value.
 * @param config - Optional replacement name set.
 * @returns `true` for an abort / timeout error.
 *
 * @dbxUtil
 * @dbxUtilCategory fetch
 * @dbxUtilTags fetch, error, abort, timeout, abort-error, timeout-error, cancel, signal
 *
 * @example
 * ```ts
 * const controller = new AbortController();
 * controller.abort();
 * isFetchAbortError(controller.signal.reason); // true
 * isFetchAbortError(new TypeError('fetch failed')); // false
 * ```
 */
export function isFetchAbortError(error: unknown, config?: Maybe<Pick<FetchErrorClassificationConfig, 'abortErrorNames'>>): boolean {
  return error != null && typeof error === 'object' && errorNameMatches(error, config?.abortErrorNames ?? DEFAULT_FETCH_ABORT_ERROR_NAMES);
}

/**
 * Reads the string `code` of an object, if any.
 *
 * @param value - The value to read.
 * @returns The code, or `undefined`.
 */
function stringCodeOf(value: unknown): Maybe<string> {
  const code = value != null && typeof value === 'object' ? (value as { readonly code?: unknown }).code : undefined;
  return typeof code === 'string' ? code : undefined;
}

/**
 * Whether a value is a `TypeError` whose message is in the set.
 *
 * @param value - The value to check.
 * @param messages - The network failure messages.
 * @returns `true` on a match.
 */
function isNetworkTypeError(value: unknown, messages: ReadonlySet<string>): boolean {
  let result = false;

  if (value != null && typeof value === 'object') {
    const { name, message } = value as { readonly name?: unknown; readonly message?: unknown };
    result = name === 'TypeError' && typeof message === 'string' && messages.has(message);
  }

  return result;
}

/**
 * Whether a thrown value is a NETWORK failure — the request never got an answer.
 *
 * The checks run in this order.
 *
 * 1. Gather the string `code` of the error and of its direct `cause`.
 * 2. Any gathered code in `networkErrorCodes` → a network failure.
 * 3. Codes exist but none is in the set → NOT a network failure. A specific code outranks the generic message, so
 *    undici's `TypeError('fetch failed')` with a `cause.code` of `ENOTFOUND` or a TLS / certificate code is not one.
 * 4. No code at all: the error OR its direct cause is a `TypeError` whose message is in `networkErrorMessages`
 *    (Node's `fetch failed` and the browser messages in {@link DEFAULT_FETCH_NETWORK_ERROR_MESSAGES}). The cause level
 *    catches a wrapper that keeps the native failure as its cause.
 *
 * @param error - The thrown value.
 * @param config - Optional replacement code and message sets.
 * @returns `true` for a network failure.
 *
 * @dbxUtil
 * @dbxUtilCategory fetch
 * @dbxUtilTags fetch, error, network, socket, offline, browser, undici, type-error, econnreset
 *
 * @example
 * ```ts
 * isFetchNetworkError(new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } })); // true
 * isFetchNetworkError(new TypeError('Failed to fetch')); // true (Chromium)
 * isFetchNetworkError(new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } })); // false
 * ```
 */
export function isFetchNetworkError(error: unknown, config?: Maybe<Pick<FetchErrorClassificationConfig, 'networkErrorCodes' | 'networkErrorMessages'>>): boolean {
  let result = false;

  if (error != null && typeof error === 'object') {
    const networkErrorCodes = config?.networkErrorCodes ?? DEFAULT_FETCH_NETWORK_ERROR_CODES;
    const networkErrorMessages = config?.networkErrorMessages ?? DEFAULT_FETCH_NETWORK_ERROR_MESSAGES;
    const { cause } = error as { readonly cause?: unknown };
    const codes = [stringCodeOf(error), stringCodeOf(cause)].filter((code): code is string => code != null);

    if (codes.length > 0) {
      result = codes.some((code) => networkErrorCodes.has(code));
    } else {
      result = isNetworkTypeError(error, networkErrorMessages) || isNetworkTypeError(cause, networkErrorMessages);
    }
  }

  return result;
}

/**
 * Classifies a thrown value as `transient`, `permanent` or `unknown`.
 *
 * The rules apply in this order, and the first match wins.
 *
 * 1. not an object → `unknown`;
 * 2. a `permanentClassNames` match → `permanent`;
 * 3. {@link isFetchAbortError} → `transient`;
 * 4. a `transientClassNames` match → `transient`;
 * 5. `readStatus(error)` is a number → {@link classifyFetchErrorStatus}, returned as is (a status means the server
 *    answered, so it is never a network failure);
 * 6. {@link isFetchNetworkError} → `transient`;
 * 7. otherwise → `unknown`.
 *
 * @param error - The thrown value.
 * @param config - Optional sets and status reader.
 * @returns The classification.
 *
 * @dbxUtil
 * @dbxUtilCategory fetch
 * @dbxUtilTags fetch, error, classify, retry, transient, permanent, unknown, network, status, abort
 * @dbxUtilRelated is-retryable-fetch-error-classification
 *
 * @example
 * ```ts
 * classifyFetchError({ status: 503 }); // 'transient'
 * classifyFetchError(new TypeError('Failed to fetch')); // 'transient'
 * classifyFetchError({ status: 401 }); // 'permanent'
 * classifyFetchError(new Error('boom')); // 'unknown'
 * ```
 */
export function classifyFetchError(error: unknown, config?: Maybe<FetchErrorClassificationConfig>): FetchErrorClassification {
  let classification: FetchErrorClassification = 'unknown';

  if (error != null && typeof error === 'object') {
    const status = (config?.readStatus ?? readFetchErrorStatus)(error);

    if (config?.permanentClassNames != null && errorNameMatches(error, config.permanentClassNames)) {
      classification = 'permanent';
    } else if (isFetchAbortError(error, config) || (config?.transientClassNames != null && errorNameMatches(error, config.transientClassNames))) {
      classification = 'transient';
    } else if (status != null) {
      classification = classifyFetchErrorStatus(status, config);
    } else if (isFetchNetworkError(error, config)) {
      classification = 'transient';
    }
  }

  return classification;
}

// MARK: Retry Policy
/**
 * Input to {@link isRetryableFetchErrorClassification}.
 */
export interface IsRetryableFetchErrorClassificationConfig {
  /**
   * The error's classification.
   */
  readonly classification: FetchErrorClassification;
  /**
   * The thrown value, handed to `isRetryableUnknownError`.
   */
  readonly error: unknown;
  /**
   * The host's call on an `unknown` error.
   */
  readonly isRetryableUnknownError?: Maybe<IsRetryableUnknownErrorFunction>;
  /**
   * The answer for an `unknown` error when the function is absent or answers nothing — the caller's policy.
   */
  readonly retryUnknownByDefault: boolean;
}

/**
 * The shared resend rule: `transient` → `true`, `permanent` → `false`, `unknown` →
 * `isRetryableUnknownError(error) ?? retryUnknownByDefault`. The function is never consulted for a `transient` or
 * `permanent` error.
 *
 * @param config - The classification, the error, the host function and the caller's default.
 * @returns Whether to resend / requeue.
 *
 * @dbxUtil
 * @dbxUtilCategory fetch
 * @dbxUtilTags fetch, error, retry, policy, classify, transient, permanent, unknown, requeue
 * @dbxUtilRelated classify-fetch-error
 *
 * @example
 * ```ts
 * isRetryableFetchErrorClassification({ classification: 'unknown', error, retryUnknownByDefault: false }); // false
 * isRetryableFetchErrorClassification({ classification: 'unknown', error, isRetryableUnknownError: () => true, retryUnknownByDefault: false }); // true
 * ```
 */
export function isRetryableFetchErrorClassification(config: IsRetryableFetchErrorClassificationConfig): boolean {
  const { classification, error, isRetryableUnknownError, retryUnknownByDefault } = config;
  let retryable: boolean;

  switch (classification) {
    case 'transient':
      retryable = true;
      break;
    case 'permanent':
      retryable = false;
      break;
    default:
      retryable = isRetryableUnknownError?.(error) ?? retryUnknownByDefault;
      break;
  }

  return retryable;
}
