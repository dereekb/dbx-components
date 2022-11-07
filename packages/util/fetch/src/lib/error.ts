import { BaseError } from 'make-error';

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
