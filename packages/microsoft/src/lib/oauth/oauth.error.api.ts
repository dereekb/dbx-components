import { type Maybe, OidcRelyingPartyError } from '@dereekb/util';
import { type ConfiguredFetch, type FetchRequestFactoryError, FetchResponseError } from '@dereekb/util/fetch';
import { BaseError } from 'make-error';

/**
 * Error code returned when a code or refresh token is invalid, expired, or was already spent.
 */
export const MICROSOFT_OAUTH_INVALID_GRANT_ERROR_CODE = 'invalid_grant';

/**
 * Error code returned when the requested scope set is not one the application may ask for.
 */
export const MICROSOFT_OAUTH_INVALID_SCOPE_ERROR_CODE = 'invalid_scope';

/**
 * The error body the Microsoft identity platform's OAuth endpoints return: RFC 6749's `error` /
 * `error_description`, plus Entra's numeric AADSTS `error_codes`, `trace_id` and `correlation_id`.
 *
 * Deliberately not the Graph error type (`MicrosoftGraphError`), whose body is `{ error: { code, message } }`.
 */
export interface MicrosoftOAuthErrorData {
  readonly error: string;
  readonly error_description?: Maybe<string>;
  /**
   * The AADSTS error numbers, e.g. `[70008]` for an expired refresh token.
   */
  readonly error_codes?: Maybe<readonly number[]>;
  readonly trace_id?: Maybe<string>;
  readonly correlation_id?: Maybe<string>;
}

/**
 * An error reported by a Microsoft OAuth endpoint.
 */
export class MicrosoftOAuthError<D extends MicrosoftOAuthErrorData = MicrosoftOAuthErrorData> extends BaseError {
  get code(): string {
    return this.error.error;
  }

  constructor(readonly error: D) {
    super(error.error_description ? `${error.error}: ${error.error_description}` : error.error);
  }
}

/**
 * A {@link MicrosoftOAuthError} that retains the HTTP response it was parsed from.
 */
export class MicrosoftOAuthFetchResponseError<D extends MicrosoftOAuthErrorData = MicrosoftOAuthErrorData> extends MicrosoftOAuthError<D> {
  constructor(
    readonly data: D,
    readonly responseError: FetchResponseError
  ) {
    super(data);
  }
}

export type LogMicrosoftOAuthErrorFunction = (error: FetchRequestFactoryError | MicrosoftOAuthError) => void;

/**
 * Creates a {@link LogMicrosoftOAuthErrorFunction} that logs the error to the console.
 *
 * @param microsoftApiNamePrefix - Prefix to use when logging, e.g. `MicrosoftOAuth`.
 * @returns A log function that prefixes each logged error.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function logMicrosoftOAuthErrorFunction(microsoftApiNamePrefix: string): LogMicrosoftOAuthErrorFunction {
  return (error: FetchRequestFactoryError | MicrosoftOAuthError) => {
    if (error instanceof MicrosoftOAuthFetchResponseError) {
      console.log(`${microsoftApiNamePrefix}Error(${error.responseError.response.status}): `, { error, errorData: error.data });
    } else if (error instanceof MicrosoftOAuthError) {
      console.log(`${microsoftApiNamePrefix}Error(code:${error.code}): `, { error });
    } else {
      console.log(`${microsoftApiNamePrefix}Error(name:${error.name}): `, { error });
    }
  };
}

export const logMicrosoftOAuthErrorToConsole = logMicrosoftOAuthErrorFunction('MicrosoftOAuth');

/**
 * Parses a {@link FetchResponseError} from a Microsoft OAuth call into a typed error.
 *
 * @param responseError - The fetch response error to parse.
 * @returns The parsed error, or undefined when the body carried no OAuth error to parse.
 */
export async function parseMicrosoftOAuthError(responseError: FetchResponseError): Promise<Maybe<MicrosoftOAuthFetchResponseError>> {
  const data: Maybe<MicrosoftOAuthErrorData> = await responseError.response
    .clone()
    .json()
    .catch(() => undefined);

  let result: Maybe<MicrosoftOAuthFetchResponseError>;

  if (typeof data?.error === 'string') {
    result = new MicrosoftOAuthFetchResponseError(data, responseError);
  }

  return result;
}

/**
 * Wraps a {@link ConfiguredFetch} so that Microsoft OAuth error responses surface as typed errors.
 *
 * @param fetch - The fetch to wrap.
 * @param logError - Optional override of the error logging function.
 * @returns The wrapped fetch.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function handleMicrosoftOAuthErrorFetch(fetch: ConfiguredFetch, logError: LogMicrosoftOAuthErrorFunction = logMicrosoftOAuthErrorToConsole): ConfiguredFetch {
  return async (x, y) => {
    try {
      return await fetch(x, y); // await to catch thrown errors
    } catch (e) {
      if (e instanceof FetchResponseError) {
        const error = await parseMicrosoftOAuthError(e);

        if (error) {
          logError(error); // log before throwing
          throw error;
        }
      }

      throw e;
    }
  };
}

/**
 * Returns whether a thrown value is the Microsoft identity platform refusing a grant (`invalid_grant`) —
 * an expired, revoked or already-redeemed code or refresh token, or consent that no longer covers the
 * requested scopes.
 *
 * Recognises both the typed {@link MicrosoftOAuthError} the error-surfacing fetch produces and the
 * `TOKEN_INVALID_GRANT` relying-party error `@dereekb/util/oidc` raises when the fetch is not wrapped.
 *
 * @param e - The thrown value.
 * @returns True when the error is `invalid_grant`.
 */
export function isMicrosoftOAuthInvalidGrantError(e: unknown): boolean {
  let result = false;

  if (e instanceof MicrosoftOAuthError) {
    result = e.code === MICROSOFT_OAUTH_INVALID_GRANT_ERROR_CODE;
  } else if (e instanceof OidcRelyingPartyError) {
    result = e.code === 'TOKEN_INVALID_GRANT';
  }

  return result;
}
