import { BaseError } from 'make-error';
import type { Maybe } from '@dereekb/util';
import { type RequestInitWithTimeout, type RequestWithTimeout } from './fetch.type';

export class FetchTimeoutError extends BaseError {
  constructor(
    readonly response: Response,
    readonly timeout: number
  ) {
    super(`Fetch response was timed out (${timeout})`);
  }
}

/**
 * Wraps a fetch function to add automatic timeout/abort support. If a timeout value is present on the
 * RequestInit or Request, the request is aborted after that many milliseconds without a response. A timeout
 * of 0 disables it.
 *
 * An abort signal the caller already set (on the RequestInit, or on the Request itself) keeps working: the
 * request aborts on whichever comes first, the caller's signal or the timeout.
 *
 * The timeout covers the wait for the response (its headers). Reading the body afterwards is not timed out;
 * abort the caller's signal for that.
 *
 * @param inputFetch - The fetch function to wrap with timeout behavior.
 * @returns A wrapped fetch function that enforces timeouts via AbortController.
 */
export function fetchTimeout(inputFetch: typeof fetch): typeof fetch {
  return (input: RequestInfo | URL, init: Maybe<RequestInit>) => {
    const timeout: Maybe<number> = (init as Maybe<RequestInitWithTimeout>)?.timeout ?? (input as RequestWithTimeout).timeout;
    let responsePromise: Promise<Response>;

    if (timeout) {
      const controller = new AbortController();
      const callerSignal = init?.signal ?? (typeof Request !== 'undefined' && input instanceof Request ? input.signal : undefined);

      // follow the caller's signal too, so passing one never turns the timeout off nor the other way around
      if (callerSignal?.aborted) {
        controller.abort(callerSignal.reason);
      } else {
        callerSignal?.addEventListener('abort', () => controller.abort(callerSignal.reason), { once: true });
      }

      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeout);

      responsePromise = inputFetch(input, { ...init, signal: controller.signal }).finally(() => {
        clearTimeout(timeoutId);
      });
    } else {
      responsePromise = inputFetch(input, init ?? undefined);
    }

    return responsePromise;
  };
}
