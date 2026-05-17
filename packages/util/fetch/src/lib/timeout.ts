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
 * Wraps a fetch function to add automatic timeout/abort support. If a timeout value
 * is present on the RequestInit or Request and no abort signal is already provided,
 * an AbortController is created to abort the request after the specified duration.
 *
 * @param inputFetch - The fetch function to wrap with timeout behavior.
 * @returns A wrapped fetch function that enforces timeouts via AbortController.
 */
export function fetchTimeout(inputFetch: typeof fetch): typeof fetch {
  return (input: RequestInfo | URL, init: Maybe<RequestInit>) => {
    let controller: Maybe<AbortController>;
    const timeout: Maybe<number> = (init as Maybe<RequestInitWithTimeout>)?.timeout ?? (input as RequestWithTimeout).timeout;

    // if signal is not provided, and a timeout is specified, configure the timeout
    if (!init?.signal && timeout) {
      const abortController = new AbortController();
      controller = abortController;

      init = {
        ...init,
        signal: abortController.signal // pass the abort signal
      };
    }

    let responsePromise = inputFetch(input, init);

    if (timeout) {
      const timeoutId = setTimeout(() => {
        controller?.abort();
      }, timeout);

      responsePromise = responsePromise.finally(() => {
        clearTimeout(timeoutId);
      });
    }

    return responsePromise;
  };
}
