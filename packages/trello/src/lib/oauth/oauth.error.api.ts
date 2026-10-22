import { type Maybe } from '@dereekb/util';
import { type ConfiguredFetch, type FetchRequestFactoryError, FetchResponseError } from '@dereekb/util/fetch';
import { BaseError } from 'make-error';

/**
 * Error code returned when a code or refresh token is invalid, expired, or was already spent.
 */
export const TRELLO_OAUTH_INVALID_GRANT_ERROR_CODE = 'invalid_grant';

/**
 * The RFC 6749 error body Atlassian's token endpoint returns.
 */
export interface TrelloOAuthErrorData {
  readonly error: string;
  readonly error_description?: Maybe<string>;
}

/**
 * An error reported by Trello's OAuth 2.0 token endpoint.
 */
export class TrelloOAuthError<D extends TrelloOAuthErrorData = TrelloOAuthErrorData> extends BaseError {
  get code(): string {
    return this.error.error;
  }

  constructor(readonly error: D) {
    super(error.error_description ? `${error.error}: ${error.error_description}` : error.error);
  }
}

/**
 * A {@link TrelloOAuthError} that retains the HTTP response it was parsed from.
 */
export class TrelloOAuthFetchResponseError<D extends TrelloOAuthErrorData = TrelloOAuthErrorData> extends TrelloOAuthError<D> {
  constructor(
    readonly data: D,
    readonly responseError: FetchResponseError
  ) {
    super(data);
  }
}

export type LogTrelloOAuthErrorFunction = (error: FetchRequestFactoryError | TrelloOAuthError) => void;

/**
 * Creates a {@link LogTrelloOAuthErrorFunction} that logs the error to the console.
 *
 * @param trelloApiNamePrefix - Prefix to use when logging, e.g. `TrelloOAuth`.
 * @returns A log function that prefixes each logged error.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function logTrelloOAuthErrorFunction(trelloApiNamePrefix: string): LogTrelloOAuthErrorFunction {
  return (error: FetchRequestFactoryError | TrelloOAuthError) => {
    if (error instanceof TrelloOAuthFetchResponseError) {
      console.log(`${trelloApiNamePrefix}Error(${error.responseError.response.status}): `, { error, errorData: error.data });
    } else if (error instanceof TrelloOAuthError) {
      console.log(`${trelloApiNamePrefix}Error(code:${error.code}): `, { error });
    } else {
      console.log(`${trelloApiNamePrefix}Error(name:${error.name}): `, { error });
    }
  };
}

export const logTrelloOAuthErrorToConsole = logTrelloOAuthErrorFunction('TrelloOAuth');

/**
 * Parses a {@link FetchResponseError} from a Trello OAuth call into a typed error.
 *
 * @param responseError - The fetch response error to parse.
 * @returns The parsed error, or undefined when the body carried no OAuth error to parse.
 */
export async function parseTrelloOAuthError(responseError: FetchResponseError): Promise<Maybe<TrelloOAuthFetchResponseError>> {
  const data: Maybe<TrelloOAuthErrorData> = await responseError.response
    .clone()
    .json()
    .catch(() => undefined);

  let result: Maybe<TrelloOAuthFetchResponseError>;

  if (data?.error) {
    result = new TrelloOAuthFetchResponseError(data, responseError);
  }

  return result;
}

/**
 * Wraps a {@link ConfiguredFetch} so that OAuth error responses surface as typed errors.
 *
 * @param fetch - The fetch to wrap.
 * @param logError - Optional override of the error logging function.
 * @returns The wrapped fetch.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function handleTrelloOAuthErrorFetch(fetch: ConfiguredFetch, logError: LogTrelloOAuthErrorFunction = logTrelloOAuthErrorToConsole): ConfiguredFetch {
  return async (x, y) => {
    try {
      return await fetch(x, y); // await to catch thrown errors
    } catch (e) {
      if (e instanceof FetchResponseError) {
        const error = await parseTrelloOAuthError(e);

        if (error) {
          logError(error); // log before throwing
          throw error;
        }
      }

      throw e;
    }
  };
}
