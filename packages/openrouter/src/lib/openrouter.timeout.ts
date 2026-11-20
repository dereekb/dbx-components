import { type Maybe, type Milliseconds } from '@dereekb/util';
import { type RequestOptions } from './openrouter.sdk';

/**
 * Merges abort signals into one that aborts as soon as any of them aborts, carrying that signal's reason.
 *
 * Uses `AbortSignal.any` when the runtime has it, and otherwise wires an `AbortController` to each signal by hand.
 *
 * @param signals - The signals to merge.
 * @returns A signal that aborts when any input signal aborts.
 */
export function anyOpenRouterAbortSignal(signals: readonly AbortSignal[]): AbortSignal {
  let result: AbortSignal;

  if (typeof AbortSignal.any === 'function') {
    result = AbortSignal.any([...signals]);
  } else {
    const controller = new AbortController();
    const alreadyAborted = signals.find((signal) => signal.aborted);

    if (alreadyAborted == null) {
      for (const signal of signals) {
        signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true, signal: controller.signal });
      }
    } else {
      controller.abort(alreadyAborted.reason);
    }

    result = controller.signal;
  }

  return result;
}

/**
 * Folds a request timeout into the request options so that it holds even when the caller passes a `signal`.
 *
 * The SDK applies `timeoutMs` only when the request carries no `signal`, so passing both silently drops the timeout.
 * This keeps `timeoutMs` when the caller passed no signal (the SDK then times out each HTTP attempt on its own), and
 * otherwise replaces the caller's signal with one merged from it and `AbortSignal.timeout(timeoutMs)`.
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
    result = { ...rest, signal: anyOpenRouterAbortSignal([callerSignal, AbortSignal.timeout(timeoutMs)]) };
  }

  return result;
}
