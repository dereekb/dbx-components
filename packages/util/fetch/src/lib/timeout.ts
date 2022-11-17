import { BaseError } from 'make-error';
import { RequestInitWithTimeout, RequestWithTimeout } from './fetch.type';

export class FetchTimeoutError extends BaseError {
  constructor(readonly response: Response, readonly timeout: number) {
    super(`Fetch response was timed out (${timeout})`);
  }
}

export function fetchTimeout(inputFetch: typeof fetch): typeof fetch {
  return (input: RequestInfo | URL, init: RequestInit | undefined) => {
    let controller: AbortController | undefined;
    const timeout: number | null | undefined = (init as RequestInitWithTimeout)?.timeout ?? (input as RequestWithTimeout).timeout;

    // if signal is not provided, and a timeout is specified, configure the timeout
    if (!init?.signal && timeout) {
      controller = new AbortController();

      init = {
        ...init,
        signal: controller.signal // pass the abort signal
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
