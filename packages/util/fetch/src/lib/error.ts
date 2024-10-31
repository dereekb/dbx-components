import { BaseError } from 'make-error';

/**
 * Thrown by a FetchRequestFactory if one of the async request initialization steps fails.
 */
export class FetchRequestFactoryError extends BaseError {
  constructor(readonly error: Error | unknown) {
    super(`Fetch request failed to build due to an unexpected error: ${typeof error === 'object' ? (error as Error).message ?? '' : ''}`);
  }
}

/**
 * Wraps the input fetch function to always pass the fetch response promise to requireOkResponse().
 *
 * @param inputFetch
 * @returns
 */
export function fetchOk(inputFetch: typeof fetch): typeof fetch {
  return (input, init) => requireOkResponse(inputFetch(input, init));
}

export class FetchResponseError extends BaseError {
  constructor(readonly response: Response) {
    super(`Fetch response was a non-ok status code (${response.status}): ${response.statusText}`);
  }
}

export function requireOkResponse(responsePromise: Promise<Response>): Promise<Response> {
  return responsePromise.then((response) => {
    if (!response.ok) {
      throw new FetchResponseError(response);
    }

    return response;
  });
}
