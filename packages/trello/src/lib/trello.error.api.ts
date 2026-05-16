import { type Maybe } from '@dereekb/util';
import { type ConfiguredFetch, type FetchRequestFactoryError, FetchResponseError } from '@dereekb/util/fetch';
import { BaseError } from 'make-error';

/**
 * Raw error body shape returned by the Trello API.
 *
 * Trello commonly returns a plain text body (e.g. "invalid token") rather than JSON.
 * This shape captures both the parsed JSON case and the text fallback.
 */
export interface TrelloServerErrorData {
  /**
   * Status code of the underlying HTTP response.
   */
  readonly status: number;
  /**
   * Raw response body as text. Always present.
   */
  readonly bodyText: string;
  /**
   * Parsed JSON body when the response had a JSON content type.
   */
  readonly bodyJson?: unknown;
}

/**
 * Base Trello server error.
 */
export class TrelloServerError extends BaseError {
  constructor(
    message: string,
    readonly data: TrelloServerErrorData
  ) {
    super(message);
  }

  get status(): number {
    return this.data.status;
  }
}

/**
 * Trello server error that retains the originating fetch response.
 */
export class TrelloServerFetchResponseError extends TrelloServerError {
  constructor(
    message: string,
    data: TrelloServerErrorData,
    readonly responseError: FetchResponseError
  ) {
    super(message, data);
  }
}

/**
 * Trello returned 401 — typically a revoked or otherwise invalid token.
 *
 * @see https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/
 */
export class TrelloInvalidTokenError extends TrelloServerFetchResponseError {}

/**
 * Trello returned 429 — too many requests.
 */
export class TrelloTooManyRequestsError extends TrelloServerFetchResponseError {
  get retryAfter(): Maybe<number> {
    const headerValue = this.responseError.response.headers.get('Retry-After');
    return headerValue ? Number(headerValue) : undefined;
  }
}

export type LogTrelloServerErrorFunction = (error: FetchRequestFactoryError | TrelloServerError) => void;

/**
 * Creates a logTrelloServerErrorFunction that logs the error to console.
 *
 * @param trelloApiNamePrefix Prefix to use when logging.
 * @returns A function that logs Trello server errors to the console.
 * @__NO_SIDE_EFFECTS__
 */
export function logTrelloServerErrorFunction(trelloApiNamePrefix: string): LogTrelloServerErrorFunction {
  return (error: FetchRequestFactoryError | TrelloServerError) => {
    if (error instanceof TrelloServerFetchResponseError) {
      console.log(`${trelloApiNamePrefix}Error(${error.responseError.response.status}): `, { error, errorData: error.data });
    } else if (error instanceof TrelloServerError) {
      console.log(`${trelloApiNamePrefix}Error(status:${error.status}): `, { error });
    } else {
      console.log(`${trelloApiNamePrefix}Error(name:${error.name}): `, { error });
    }
  };
}

export const logTrelloErrorToConsole = logTrelloServerErrorFunction('Trello');

/**
 * Parses a FetchResponseError into a typed Trello API error.
 *
 * @param responseError The fetch response error to parse.
 * @returns A typed Trello error, or undefined if the response could not be parsed.
 */
export async function parseTrelloApiError(responseError: FetchResponseError): Promise<Maybe<TrelloServerFetchResponseError>> {
  const response = responseError.response;
  const bodyText = await response
    .clone()
    .text()
    .catch(() => '');

  let bodyJson: unknown;
  try {
    bodyJson = bodyText ? JSON.parse(bodyText) : undefined;
  } catch {
    bodyJson = undefined;
  }

  const data: TrelloServerErrorData = {
    status: response.status,
    bodyText,
    bodyJson
  };

  const message = bodyText || `Trello request failed with status ${response.status}`;

  let result: TrelloServerFetchResponseError;

  switch (response.status) {
    case 401:
      result = new TrelloInvalidTokenError(message, data, responseError);
      break;
    case 429:
      result = new TrelloTooManyRequestsError(message, data, responseError);
      break;
    default:
      result = new TrelloServerFetchResponseError(message, data, responseError);
      break;
  }

  return result;
}

/**
 * Wraps a ConfiguredFetch to translate FetchResponseError into typed Trello errors.
 *
 * @param fetch The fetch to wrap.
 * @param logError Optional logger.
 * @returns A ConfiguredFetch that throws typed Trello errors for known error responses.
 * @__NO_SIDE_EFFECTS__
 */
export function handleTrelloErrorFetch(fetch: ConfiguredFetch, logError: LogTrelloServerErrorFunction = logTrelloErrorToConsole): ConfiguredFetch {
  return async (x, y) => {
    try {
      return await fetch(x, y);
    } catch (e) {
      if (e instanceof FetchResponseError) {
        const error = await parseTrelloApiError(e);

        if (error) {
          logError(error);
          throw error;
        }
      }

      throw e;
    }
  };
}
