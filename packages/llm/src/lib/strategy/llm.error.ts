/**
 * The LLM **error vocabulary** a retry decision reads: which throws from `strategy.complete` are ABORTS (the client
 * gave up waiting), which an IDENTICAL RESEND can fix (the call never reached the model), and a one-line summary of
 * what was thrown.
 *
 * Every predicate here classifies STRUCTURALLY, by the error's constructor names, its `status` and its socket codes,
 * so it needs no SDK import and works on whatever a strategy throws.
 */

import { joinStrings, type Maybe } from '@dereekb/util';

/**
 * Every constructor NAME on a thrown value's prototype chain, leaf first — the STRUCTURAL identity the `openai`
 * SDK's error classes actually carry.
 *
 * WHY NOT `error.name`: the SDK never assigns `this.name` on ANY of its error classes (the constructors set `status`
 * / `headers` / `requestID` / `code` and nothing else), so every instance inherits `Error.prototype.name ===
 * 'Error'`. Classifying on `.name` therefore matched exactly NONE of them in production, and a connection blip fell
 * through to `throw` and killed whole billed runs — while the specs stayed green, because they hand-fabricated
 * `.name` on a plain `Error`, a shape production never produces.
 *
 * WHY NOT `instanceof`: strategies deliberately keep the SDK behind one lazy boundary module (an
 * `await import('openai')` plus an injectable structural client), so a classifier must not statically import it — a
 * top-level `import { APIConnectionError } from 'openai'` would drag the whole SDK in for hosts that only ever run a
 * scripted strategy or an injected client, and a lazy import is unavailable inside a synchronous predicate.
 *
 * WHY THE WHOLE CHAIN, not just `error.constructor.name`: `APIConnectionTimeoutError` EXTENDS `APIConnectionError`,
 * and the leaf name alone is precisely what let the PARENT fall through while its own subclass was caught, the first
 * time this was found. Matching an ANCESTOR name makes a future subclass retryable by inheritance, the way
 * `instanceof` would, with zero imports.
 *
 * @param error - The thrown value.
 * @returns The chain's constructor names (leaf first), stopping at `Object.prototype`. Empty for a non-object.
 */
function errorClassNames(error: unknown): readonly string[] {
  const names: string[] = [];

  if (error != null && typeof error === 'object') {
    let proto: Maybe<object> = Object.getPrototypeOf(error) as Maybe<object>;

    while (proto != null && proto !== Object.prototype) {
      const className = (proto as { readonly constructor?: { readonly name?: unknown } }).constructor?.name;

      if (typeof className === 'string' && className !== '') {
        names.push(className);
      }

      proto = Object.getPrototypeOf(proto) as Maybe<object>;
    }
  }

  return names;
}

/**
 * The DOMException `.name` values a plain {@link AbortSignal} rejection carries. These DO set `.name` correctly, and
 * their `constructor.name` is only `DOMException` — so `.name` is the ONLY thing that tells them apart, and the
 * `.name` branch below exists for them.
 */
const ABORT_ERROR_NAMES: ReadonlySet<string> = new Set(['AbortError', 'TimeoutError']);

/**
 * The SDK error CLASSES that mean "the client gave up waiting", matched anywhere on the prototype chain.
 */
const ABORT_ERROR_CLASSES: ReadonlySet<string> = new Set(['APIUserAbortError', 'APIConnectionTimeoutError']);

/**
 * The SDK error CLASSES whose remedy is an identical resend, matched anywhere on the prototype chain.
 */
const TRANSPORT_ERROR_CLASSES: ReadonlySet<string> = new Set(['APIConnectionError', 'RateLimitError', 'InternalServerError']);

/**
 * The Node / undici socket codes a raw `fetch` failure carries (on the error or its `cause`) when the far end never
 * answered: refused, reset, unreachable or timed out. A DNS miss (`ENOTFOUND`) is left out: a misspelled host is a
 * fact a resend cannot change.
 */
const TRANSPORT_SOCKET_CODES: ReadonlySet<string> = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE', 'EAI_AGAIN', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT']);

/**
 * Whether a thrown value is a RAW `fetch` transport failure (no SDK in between: a host that calls `fetch` directly):
 * undici's `TypeError('fetch failed')`, or an error whose own or `cause`'s `code` is a
 * {@link TRANSPORT_SOCKET_CODES} code.
 *
 * @param error - The thrown value (an object).
 * @returns `true` when the socket never reached the far end.
 */
function isRawFetchTransportError(error: object): boolean {
  const { name, message, code, cause } = error as { readonly name?: unknown; readonly message?: unknown; readonly code?: unknown; readonly cause?: unknown };
  const causeCode = cause != null && typeof cause === 'object' ? (cause as { readonly code?: unknown }).code : undefined;
  const fetchFailed = name === 'TypeError' && message === 'fetch failed';
  return fetchFailed || (typeof code === 'string' && TRANSPORT_SOCKET_CODES.has(code)) || (typeof causeCode === 'string' && TRANSPORT_SOCKET_CODES.has(causeCode));
}

/**
 * Whether a thrown value is an ABORT / timeout error — the per-request timeout signal (`makeTimeoutAbortSignal`) firing (the SDK's
 * `APIUserAbortError` / `APIConnectionTimeoutError`, or the raw `AbortError` / `TimeoutError` DOMException). A
 * dispatcher classifies a match as a retryable `'timeout'` decode failure; any other throw propagates unchanged.
 *
 * Note `APIConnectionTimeoutError` matches {@link isRetryableLlmError} too (it EXTENDS `APIConnectionError`). A caller
 * tests THIS predicate FIRST, which is what keeps a headers timeout in the identical-resend `'timeout'` lane rather
 * than the jittered-backoff `'transport'` one — that ordering is load-bearing.
 *
 * @param error - The thrown value.
 * @returns `true` when it is an abort / timeout error.
 */
export function isAbortError(error: unknown): boolean {
  const name = error != null && typeof error === 'object' ? (error as { readonly name?: unknown }).name : undefined;
  const byName = typeof name === 'string' && (ABORT_ERROR_NAMES.has(name) || ABORT_ERROR_CLASSES.has(name));
  const byClass = errorClassNames(error).some((className) => ABORT_ERROR_CLASSES.has(className));

  return byName || byClass;
}

/**
 * Whether a thrown value is a RETRYABLE TRANSPORT failure — the call never reached the model, so resending the
 * identical bytes is the whole fix. Four families: the SDK's `APIConnectionError` (the literal `Connection error.` a
 * reset / DNS / refused socket raises), a rate limit (`RateLimitError` / HTTP 429), a gateway-side 5xx
 * (`InternalServerError` and friends), and a RAW `fetch` socket failure ({@link isRawFetchTransportError}: a host
 * that calls `fetch` directly, with no SDK).
 *
 * WHY THIS EXISTS: strategies deliberately set `maxRetries: 0` (the DISPATCHER owns retries), so a transport blip the
 * dispatcher does not classify kills the whole run. A rate-limited batch lost entire billed runs that way, which is
 * how this was found.
 *
 * WHY BY CLASS: a first remedy landed NAME-based, and the SDK never sets `.name` (see {@link errorClassNames}), so it
 * only ever closed the `status`-bearing half — 429s and gateway 5xx retried via `byStatus` while every
 * connection-level failure, which carries `status: undefined`, still fell through.
 *
 * A 4xx that is NOT 429 is deliberately EXCLUDED: a 400 / 401 / 404 is a fact about the request or the credential
 * that resending cannot change, and retrying it would burn the attempt budget to arrive at the same answer more
 * slowly.
 *
 * @param error - The thrown value.
 * @returns `true` when an identical resend could plausibly succeed.
 */
export function isRetryableLlmError(error: unknown): boolean {
  let retryable: boolean;

  if (error == null || typeof error !== 'object') {
    retryable = false;
  } else {
    const { name, status } = error as { readonly name?: unknown; readonly status?: unknown };
    const byName = typeof name === 'string' && TRANSPORT_ERROR_CLASSES.has(name);
    const byClass = errorClassNames(error).some((className) => TRANSPORT_ERROR_CLASSES.has(className));
    const byStatus = typeof status === 'number' && (status === 429 || status >= 500);

    retryable = byName || byClass || byStatus || isRawFetchTransportError(error);
  }

  return retryable;
}

/**
 * The longest a {@link llmErrorSummaryOf} summary is kept at — one log line's worth, so a provider body echoed into
 * `message` cannot bloat the event.
 */
export const LLM_ERROR_SUMMARY_MAX_LENGTH = 200;

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
export function llmErrorSummaryOf(error: unknown): string {
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

  return summary.length > LLM_ERROR_SUMMARY_MAX_LENGTH ? summary.slice(0, LLM_ERROR_SUMMARY_MAX_LENGTH) : summary;
}
