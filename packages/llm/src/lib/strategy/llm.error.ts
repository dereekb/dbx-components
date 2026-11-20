/**
 * llm's layer over `@dereekb/util/fetch`'s transport-error classifier ({@link classifyFetchError}): the SDK class
 * sets an LLM strategy's throws carry, the abort lane's predicate, the one resend rule both dispatcher lanes apply,
 * and the one-line summary a decode / failed-attempt row records.
 *
 * The generic rules (abort names, socket codes, the Node and browser network messages, "408 / 429 / 5xx is
 * transient, 400–404 permanent") live in util/fetch; llm only adds what the `openai` SDK needs.
 */

import { cutStringFunction, errorClassNames, joinStrings, type Maybe } from '@dereekb/util';
import { classifyFetchError, DEFAULT_FETCH_ABORT_ERROR_NAMES, type FetchErrorClassification, type FetchErrorClassificationConfig, isFetchAbortError, isRetryableFetchErrorClassification, type IsRetryableUnknownErrorFunction } from '@dereekb/util/fetch';

/**
 * llm's classification policy: util/fetch's defaults plus the `openai` SDK's class sets, matched anywhere on the
 * prototype chain.
 *
 * WHY BY CLASS, NOT `error.name`: the SDK never assigns `this.name` on ANY of its error classes (the constructors set
 * `status` / `headers` / `requestID` / `code` and nothing else), so every instance inherits `Error.prototype.name ===
 * 'Error'`; classifying on `.name` would match none of them. A spec that hand-fabricates `.name` on a plain `Error`
 * tests a shape the SDK never produces.
 *
 * WHY NOT `instanceof`: strategies deliberately keep the SDK behind one lazy boundary module (an
 * `await import('openai')` plus an injectable structural client), so a classifier must not statically import it — a
 * top-level `import { APIConnectionError } from 'openai'` would drag the whole SDK in for hosts that only ever run a
 * scripted strategy or an injected client, and a lazy import is unavailable inside a synchronous predicate.
 *
 * WHY THE WHOLE CHAIN, not just `error.constructor.name`: `APIConnectionTimeoutError` EXTENDS `APIConnectionError`,
 * and the leaf name alone is precisely what let the PARENT fall through while its own subclass was caught, the first
 * time this was found. Matching an ANCESTOR name makes a future subclass match by inheritance.
 *
 * - `abortErrorNames` adds `APIUserAbortError` / `APIConnectionTimeoutError` (the client gave up waiting).
 * - `transientClassNames` adds `APIConnectionError` (the literal `Connection error.` a reset / DNS / refused socket
 *   raises, with no `status`), `RateLimitError` and `InternalServerError`.
 */
export const LLM_ERROR_CLASSIFICATION_CONFIG: FetchErrorClassificationConfig = {
  abortErrorNames: new Set([...Array.from(DEFAULT_FETCH_ABORT_ERROR_NAMES), 'APIUserAbortError', 'APIConnectionTimeoutError']),
  transientClassNames: new Set(['APIConnectionError', 'RateLimitError', 'InternalServerError'])
};

/**
 * Whether a thrown value is an ABORT / timeout error — the per-request timeout signal (`makeTimeoutAbortSignal`)
 * firing (the SDK's `APIUserAbortError` / `APIConnectionTimeoutError`, or the raw `AbortError` / `TimeoutError`
 * DOMException). A dispatcher's completion lane resends a match as a `'timeout'` decode failure.
 *
 * Test it FIRST: `APIConnectionTimeoutError` EXTENDS `APIConnectionError`, so it is transient by class too. Testing
 * this predicate first is what keeps a headers timeout in the identical-resend `'timeout'` lane rather than the
 * jittered-backoff `'transport'` one — that ordering is load-bearing.
 *
 * @param error - The thrown value.
 * @returns `true` when it is an abort / timeout error.
 */
export function isLlmAbortError(error: unknown): boolean {
  return isFetchAbortError(error, LLM_ERROR_CLASSIFICATION_CONFIG);
}

/**
 * Classifies a strategy's throw with util/fetch's {@link classifyFetchError} under {@link LLM_ERROR_CLASSIFICATION_CONFIG}.
 *
 * The three classes read as follows.
 *
 * - `transient`: an abort / timeout, an SDK connection / rate-limit / server class, HTTP 408 / 429 / 5xx, or a
 *   Node / browser network failure — an identical resend can plausibly succeed;
 * - `permanent`: HTTP 400–404 — a fact about the request or the credential that resending cannot change;
 * - `unknown`: anything else (409, a plain `Error`, a non-object throw).
 *
 * `classifyLlmError(e) === 'transient'` covers aborts and every retryable class, plus HTTP 408 and the browser network
 * messages.
 *
 * WHY THIS EXISTS: strategies deliberately set `maxRetries: 0` (the DISPATCHER owns retries), so a transport blip the
 * dispatcher does not classify kills the whole run.
 *
 * @param error - The thrown value.
 * @returns The classification.
 */
export function classifyLlmError(error: unknown): FetchErrorClassification {
  return classifyFetchError(error, LLM_ERROR_CLASSIFICATION_CONFIG);
}

/**
 * The ONE resend rule both dispatcher lanes apply: `transient` is resent, `permanent` never is, and `unknown` is
 * resent only when the host's `isRetryableUnknownError` answers `true` (no function or no answer fails the call).
 *
 * @param classification - The error's {@link classifyLlmError} classification.
 * @param error - The thrown value, handed to `isRetryableUnknownError`.
 * @param isRetryableUnknownError - The host's call on an `unknown` error.
 * @returns Whether to resend.
 */
export function isRetryableLlmErrorClassification(classification: FetchErrorClassification, error: unknown, isRetryableUnknownError?: Maybe<IsRetryableUnknownErrorFunction>): boolean {
  return isRetryableFetchErrorClassification({ classification, error, isRetryableUnknownError, retryUnknownByDefault: false });
}

/**
 * The longest a {@link formatLlmErrorSummary} summary is kept at — one log line's worth, so a provider body echoed into
 * `message` cannot bloat the event.
 */
export const LLM_ERROR_SUMMARY_MAX_LENGTH = 200;

const cutLlmErrorSummary = cutStringFunction({ maxLength: LLM_ERROR_SUMMARY_MAX_LENGTH, endText: '' });

/**
 * One compact, log-safe line naming WHAT the transport threw — `"<leaf class> <status>: <message>"`, e.g.
 * `RateLimitError 429: Rate limit exceeded (request_id: …)` or `APIConnectionError: Connection error.` — cut to
 * {@link LLM_ERROR_SUMMARY_MAX_LENGTH}.
 *
 * WHY: a transport lane synthesizes an EMPTY reply envelope (nothing came back to excerpt), so without this the
 * decode-failure record and the backoff breadcrumb both read only `class: 'transport'` — a whole run of 429s on an
 * exhausted key is indistinguishable from a network outage until someone re-sends a request by hand. The thrown value
 * is the ONLY place the cause exists; this keeps it.
 *
 * @param error - The thrown value.
 * @returns The bounded summary; `'unknown'` for a non-object throw with no usable message.
 */
export function formatLlmErrorSummary(error: unknown): string {
  let summary: string;

  if (error == null || typeof error !== 'object') {
    summary = typeof error === 'string' && error !== '' ? error : 'unknown';
  } else {
    const { status, message } = error as { readonly status?: unknown; readonly message?: unknown };
    const [leafClass] = errorClassNames(error);
    const statusText = typeof status === 'number' ? String(status) : undefined;
    const head = joinStrings([leafClass ?? 'Error', statusText], ' ');
    // The SDK's `APIError.makeMessage` already prefixes `message` with the status (`"429 Rate limit exceeded"`);
    // it is in the head, so it is not repeated in the tail.
    const rawText = typeof message === 'string' ? message.trim() : '';
    const text = statusText != null && rawText.startsWith(`${statusText} `) ? rawText.slice(statusText.length + 1).trim() : rawText;

    summary = text === '' ? head : `${head}: ${text}`;
  }

  return cutLlmErrorSummary(summary);
}
