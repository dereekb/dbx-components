import { type Maybe, type Milliseconds, makeTimeoutAbortSignal } from '@dereekb/util';
import { type RequestOptions } from './openrouter.sdk';

/**
 * Folds a request timeout into the request options so that it holds even when the caller passes a `signal`.
 *
 * The SDK applies `timeoutMs` only when the request carries no `signal`, so passing both silently drops the timeout.
 * This keeps `timeoutMs` when the caller passed no signal (the SDK then times out each HTTP attempt on its own), and
 * otherwise replaces the caller's signal with one from {@link makeTimeoutAbortSignal}: it aborts with a `TimeoutError`
 * once `timeoutMs` passes, or earlier with the caller's own reason.
 *
 * The merged timeout starts when these options are built and covers every request made with them, so on a
 * multi-request run (the `callModel` tool loop) with a caller signal it bounds the whole run rather than each request.
 *
 * @param options - Caller-supplied options. Their `timeoutMs` is used when `requestTimeoutMs` is not set.
 * @param requestTimeoutMs - The timeout from the model config, which takes precedence over `options.timeoutMs`.
 * @returns The options to pass to the SDK.
 */
export function openRouterRequestOptionsWithTimeout(options: Maybe<RequestOptions>, requestTimeoutMs?: Maybe<Milliseconds>): RequestOptions {
  const timeoutMs = requestTimeoutMs ?? options?.timeoutMs;
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const callerSignal = options?.signal ?? options?.fetchOptions?.signal;
  let result: RequestOptions;

  if (timeoutMs == null || timeoutMs <= 0) {
    result = { ...options };
  } else if (callerSignal == null) {
    result = { ...options, timeoutMs };
  } else {
    const { timeoutMs: _timeoutMs, ...rest } = options as RequestOptions;
    result = { ...rest, signal: makeTimeoutAbortSignal({ timeout: timeoutMs, signal: callerSignal }) };
  }

  return result;
}
