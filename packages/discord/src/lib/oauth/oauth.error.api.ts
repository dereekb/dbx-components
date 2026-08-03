import { type Maybe } from '@dereekb/util';
import { type ConfiguredFetch, type FetchRequestFactoryError, FetchResponseError } from '@dereekb/util/fetch';
import { BaseError } from 'make-error';

/**
 * Error code returned when a code or refresh token is invalid, expired, or was already spent.
 */
export const DISCORD_OAUTH_INVALID_GRANT_ERROR_CODE = 'invalid_grant';

/**
 * Error code returned when the requested scope set is not one the application may ask for.
 */
export const DISCORD_OAUTH_INVALID_SCOPE_ERROR_CODE = 'invalid_scope';

/**
 * The error body Discord's OAuth endpoints return.
 *
 * Discord follows RFC 6749's `error` / `error_description` shape rather than the `code` / `message`
 * shape its own REST API uses, so this is deliberately not the REST error type.
 */
export interface DiscordOAuthErrorData {
  readonly error: string;
  readonly error_description?: Maybe<string>;
}

/**
 * An error reported by a Discord OAuth endpoint.
 */
export class DiscordOAuthError<D extends DiscordOAuthErrorData = DiscordOAuthErrorData> extends BaseError {
  get code(): string {
    return this.error.error;
  }

  constructor(readonly error: D) {
    super(error.error_description ? `${error.error}: ${error.error_description}` : error.error);
  }
}

/**
 * A {@link DiscordOAuthError} that retains the HTTP response it was parsed from.
 */
export class DiscordOAuthFetchResponseError<D extends DiscordOAuthErrorData = DiscordOAuthErrorData> extends DiscordOAuthError<D> {
  constructor(
    readonly data: D,
    readonly responseError: FetchResponseError
  ) {
    super(data);
  }
}

export type LogDiscordOAuthErrorFunction = (error: FetchRequestFactoryError | DiscordOAuthError) => void;

/**
 * Creates a {@link LogDiscordOAuthErrorFunction} that logs the error to the console.
 *
 * @param discordApiNamePrefix - Prefix to use when logging, e.g. `DiscordOAuth`.
 * @returns A log function that prefixes each logged error.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function logDiscordOAuthErrorFunction(discordApiNamePrefix: string): LogDiscordOAuthErrorFunction {
  return (error: FetchRequestFactoryError | DiscordOAuthError) => {
    if (error instanceof DiscordOAuthFetchResponseError) {
      console.log(`${discordApiNamePrefix}Error(${error.responseError.response.status}): `, { error, errorData: error.data });
    } else if (error instanceof DiscordOAuthError) {
      console.log(`${discordApiNamePrefix}Error(code:${error.code}): `, { error });
    } else {
      console.log(`${discordApiNamePrefix}Error(name:${error.name}): `, { error });
    }
  };
}

export const logDiscordOAuthErrorToConsole = logDiscordOAuthErrorFunction('DiscordOAuth');

/**
 * Parses a {@link FetchResponseError} from a Discord OAuth call into a typed error.
 *
 * @param responseError - The fetch response error to parse.
 * @returns The parsed error, or undefined when the body carried no OAuth error to parse.
 */
export async function parseDiscordOAuthError(responseError: FetchResponseError): Promise<Maybe<DiscordOAuthFetchResponseError>> {
  const data: Maybe<DiscordOAuthErrorData> = await responseError.response
    .clone()
    .json()
    .catch(() => undefined);

  let result: Maybe<DiscordOAuthFetchResponseError>;

  if (data?.error) {
    result = new DiscordOAuthFetchResponseError(data, responseError);
  }

  return result;
}

/**
 * Wraps a {@link ConfiguredFetch} so that Discord OAuth error responses surface as typed errors.
 *
 * @param fetch - The fetch to wrap.
 * @param logError - Optional override of the error logging function.
 * @returns The wrapped fetch.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function handleDiscordOAuthErrorFetch(fetch: ConfiguredFetch, logError: LogDiscordOAuthErrorFunction = logDiscordOAuthErrorToConsole): ConfiguredFetch {
  return async (x, y) => {
    try {
      return await fetch(x, y); // await to catch thrown errors
    } catch (e) {
      if (e instanceof FetchResponseError) {
        const error = await parseDiscordOAuthError(e);

        if (error) {
          logError(error); // log before throwing
          throw error;
        }
      }

      throw e;
    }
  };
}
