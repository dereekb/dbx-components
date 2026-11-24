import { type Maybe, type Milliseconds, makeTimeoutAbortSignal } from '@dereekb/util';
import { type RequestOptions } from './openrouter.sdk';

/**
 * The SDK retry setting a `@dereekb/openrouter` request carries when its caller passed no `retries`: none, so one
 * request is one attempt. A caller that wants the SDK's own backoff passes `retries` in its request options.
 */
export const DEFAULT_OPENROUTER_REQUEST_RETRIES: NonNullable<RequestOptions['retries']> = { strategy: 'none' };

/**
 * The request options `@dereekb/openrouter` hands the SDK: the caller's options, with `retries` defaulting to
 * {@link DEFAULT_OPENROUTER_REQUEST_RETRIES}.
 *
 * Without this, `@openrouter/sdk` falls back to the client's `retryConfig`, and with none to its own default: backoff
 * on 5xx, connection errors and timeouts for up to an hour — inside one run-task attempt, and on a timed-out request
 * re-sending an already-aborted signal until the hour is spent.
 *
 * An explicit `retries: undefined` also gets the default: the SDK would read it as unset and fall back the same way.
 *
 * @param options - Caller-supplied options.
 * @returns The options to pass to the SDK.
 */
export function openRouterRequestOptions(options: Maybe<RequestOptions>): RequestOptions {
  return { ...options, retries: options?.retries ?? DEFAULT_OPENROUTER_REQUEST_RETRIES };
}

/**
 * Folds a request timeout into the request options so that it holds even when the caller passes a `signal`.
 *
 * The SDK applies `timeoutMs` only when the request carries no `signal`, so passing both silently drops the timeout.
 * This keeps `timeoutMs` when the caller passed no signal (the SDK times the request's one attempt), and otherwise
 * replaces the caller's signal with one from {@link makeTimeoutAbortSignal}: it aborts with a `TimeoutError` once
 * `timeoutMs` passes, or earlier with the caller's own reason.
 *
 * The options start from {@link openRouterRequestOptions}, so every branch carries `retries`, defaulting to
 * {@link DEFAULT_OPENROUTER_REQUEST_RETRIES} when the caller passed none.
 *
 * The merged timeout starts when these options are built and covers every request made with them, so on a
 * multi-request run (the `callModel` tool loop) with a caller signal it bounds the whole run rather than each request.
 *
 * @param options - Caller-supplied options. Their `timeoutMs` is used when `requestTimeoutMs` is not set.
 * @param requestTimeoutMs - The timeout from the model config, which takes precedence over `options.timeoutMs`.
 * @returns The options to pass to the SDK.
 */
export function openRouterRequestOptionsWithTimeout(options: Maybe<RequestOptions>, requestTimeoutMs?: Maybe<Milliseconds>): RequestOptions {
  const baseOptions = openRouterRequestOptions(options);
  const timeoutMs = requestTimeoutMs ?? baseOptions.timeoutMs;
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const callerSignal = baseOptions.signal ?? baseOptions.fetchOptions?.signal;
  let result: RequestOptions;

  if (timeoutMs == null || timeoutMs <= 0) {
    result = { ...baseOptions };
  } else if (callerSignal == null) {
    result = { ...baseOptions, timeoutMs };
  } else {
    const { timeoutMs: _timeoutMs, ...rest } = baseOptions;
    result = { ...rest, signal: makeTimeoutAbortSignal({ timeout: timeoutMs, signal: callerSignal }) };
  }

  return result;
}
