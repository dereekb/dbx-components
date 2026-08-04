import { Logger } from '@nestjs/common';
import { CalcomOAuthAccessTokenError, CalcomOAuthAuthFailureError, CalcomServerFetchResponseError, type CalcomUserContext } from '@dereekb/calcom';
import { type CalcomApi, type CalcomApiContextInstance } from '@dereekb/calcom/nestjs';
import { CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, type FirebaseAuthUserId, type FirebaseAuthUserIdRef, type UserExternalConnectionErrorCode } from '@dereekb/firebase';
import { DEFAULT_USER_EXTERNAL_CONNECTION_REFRESH_FAILURE_ERROR_CODE, type UserExternalConnectionAccessor, type UserExternalConnectionCredentialsAndFailureWriter, userExternalConnectionCredentialsExpiredError, userExternalConnectionProviderNotConnectedError } from '@dereekb/firebase-server/model';
import { HTTP_UNAUTHORIZED_STATUS_CODE, type Maybe } from '@dereekb/util';
import { FetchResponseError, fetchJsonFunction, returnNullHandleFetchJsonParseErrorFunction, type ConfiguredFetch } from '@dereekb/util/fetch';
import { userExternalConnectionCalcomAccessTokenCache } from './calcom.oauth.connection.cache';

/**
 * Maps an error thrown while calling Cal.com as a user to the code to record on their connection.
 *
 * Returns null for anything that is not the grant being refused — a rate limit, a validation error, a
 * network failure, or a 403 all leave the connection itself intact, and marking it `error` for those
 * would send the user to a reconnect that fixes nothing.
 *
 * @param error - The error thrown by a Cal.com call.
 * @returns The error code to record, or null when the connection is not at fault.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function userExternalConnectionErrorCodeFromCalcomError(error: unknown): Maybe<UserExternalConnectionErrorCode> {
  let result: Maybe<UserExternalConnectionErrorCode>;

  if (error instanceof CalcomOAuthAccessTokenError) {
    // `invalid_grant`, the only code this error carries. Recorded as `expired` rather than `revoked`
    // for the same reason the reader does: the code cannot distinguish a revoked grant from a refresh
    // token that was already spent, and telling the user they revoked access when they did not would
    // send the UI down the wrong path
    result = DEFAULT_USER_EXTERNAL_CONNECTION_REFRESH_FAILURE_ERROR_CODE;
  } else if (error instanceof CalcomOAuthAuthFailureError) {
    // no usable access token could be produced from the stored refresh token
    result = 'unauthorized';
  } else if (error instanceof CalcomServerFetchResponseError) {
    result = error.responseError.response.status === HTTP_UNAUTHORIZED_STATUS_CODE ? 'unauthorized' : undefined;
  } else if (error instanceof FetchResponseError) {
    // the same rejection, for a response whose body Cal.com's error parser could not read
    result = error.response.status === HTTP_UNAUTHORIZED_STATUS_CODE ? 'unauthorized' : undefined;
  }

  return result;
}

/**
 * Turns a uid into a Cal.com API instance that acts as that user.
 *
 * The provider-specific sibling of `UserExternalConnectionReader.readerForUser`, and the only correct
 * way to make per-user Cal.com calls in an app that stores connections on the pair:
 *
 * ```ts
 * const calcom = await calcomUserContextService.calcomUserContextForUser({ uid });
 * const me = await calcom.getMe();
 * ```
 *
 * Do NOT assemble this by hand from `readUsableUserExternalConnectionCredentials()`. Cal.com runs its
 * own refresh loop through the access token cache, so a reader refresh followed by a library refresh
 * spends a rotated refresh token twice and destroys one of two valid grants.
 */
export abstract class UserExternalConnectionCalcomUserContextService {
  /**
   * Builds a Cal.com API instance scoped to the given user.
   *
   * Token rotations land durably on the user's connection pair, and a refused grant is recorded on
   * the connection entry before the error reaches the caller.
   *
   * @param input - The user to act as.
   * @returns The Cal.com API instance for that user.
   * @throws When the user is not connected to Cal.com, or their stored credentials carry no refresh
   *   token and so cannot produce an access token.
   */
  abstract calcomUserContextForUser(input: FirebaseAuthUserIdRef): Promise<CalcomApiContextInstance>;
}

/**
 * Reference to a {@link UserExternalConnectionCalcomUserContextService} instance.
 */
export interface UserExternalConnectionCalcomUserContextServiceRef {
  readonly userExternalConnectionCalcomUserContextService: UserExternalConnectionCalcomUserContextService;
}

/**
 * Configuration for {@link userExternalConnectionCalcomUserContextService}.
 *
 * Deliberately holds no surface that can refresh credentials itself. `UserExternalConnectionReader`
 * is absent for that reason: its `readUsableUserExternalConnectionCredentials` is the one call this
 * path must never make, and taking the accessor instead makes that mistake unrepresentable here.
 */
export interface UserExternalConnectionCalcomUserContextServiceConfig {
  /**
   * Builds the user context and wraps it into an API instance.
   */
  readonly calcomApi: CalcomApi;
  /**
   * Reads the stored refresh token, and backs the per-user token cache.
   */
  readonly accessor: UserExternalConnectionAccessor;
  /**
   * Persists a rotated token, and records a refused grant.
   */
  readonly actions: UserExternalConnectionCredentialsAndFailureWriter;
}

/**
 * Creates a {@link UserExternalConnectionCalcomUserContextService}.
 *
 * Instances are NOT cached per user. Each call builds a fresh token factory, so the in-memory token
 * tier lives only as long as the returned instance and one request's tokens are never visible to the
 * next. The pair-backed cache means the cost of that is a document read, not a token refresh.
 *
 * @param config - The Cal.com API, the accessor, and the write surface.
 * @returns A concrete UserExternalConnectionCalcomUserContextService implementation.
 */
export function userExternalConnectionCalcomUserContextService(config: UserExternalConnectionCalcomUserContextServiceConfig): UserExternalConnectionCalcomUserContextService {
  const { calcomApi, accessor, actions } = config;
  const providerType = CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE;
  const logger = new Logger('UserExternalConnectionCalcomUserContextService');

  /**
   * Records that Cal.com refused the user's grant.
   *
   * Never throws: the caller is already handling the provider's error, and losing that error to a
   * failed write would be worse than not recording it.
   *
   * @param uid - The user whose grant was refused.
   * @param error - The code to record.
   */
  async function reportRefusedGrant(uid: FirebaseAuthUserId, error: UserExternalConnectionErrorCode): Promise<void> {
    try {
      // skipped when the document already says this, so a caller looping calls against a dead
      // connection does not write a transaction per attempt — the same dedupe the reader's refresh
      // path performs
      const { entry } = await accessor.accessorForUser({ uid })(providerType).readUserExternalConnectionForProvider();

      if (entry?.st !== 'error' || entry.er !== error) {
        await actions.markUserExternalConnectionError({ uid, providerType, error });
      }
    } catch (e) {
      logger.error(`Failed marking the "${providerType}" connection error for uid "${uid}": `, e);
    }
  }

  /**
   * Wraps a Cal.com fetch so a refused grant is always recorded on the connection.
   *
   * Wrapping the fetch rather than asking callers to report is what makes this impossible to forget,
   * and it is the only layer that sees both failures: Cal.com resolves the access token inside the
   * request's header factory, so a dead refresh token surfaces here exactly like a 401 response does.
   *
   * @param uid - The user the fetch acts as.
   * @param fetch - The user context's fetch.
   * @returns An equivalent fetch that records a refused grant before rethrowing.
   */
  function reportingFetch(uid: FirebaseAuthUserId, fetch: ConfiguredFetch): ConfiguredFetch {
    return async (input, init) => {
      let result: Response;

      try {
        result = await fetch(input, init); // awaited so a thrown error is caught here
      } catch (e) {
        const error = userExternalConnectionErrorCodeFromCalcomError(e);

        if (error != null) {
          await reportRefusedGrant(uid, error);
        }

        throw e;
      }

      return result;
    };
  }

  async function calcomUserContextForUser(input: FirebaseAuthUserIdRef): Promise<CalcomApiContextInstance> {
    const { uid } = input;
    const { entry, credentials } = await accessor.accessorForUser({ uid })(providerType).readUserExternalConnectionForProvider();

    // an absent entry, absent credentials, or an explicit disconnect all mean the same thing: there is
    // nothing here to act as, and the remedy is for the user to connect. An `error` entry is NOT
    // refused — it keeps its credentials precisely so a refresh can repair it, and the refresh Cal.com
    // runs through the cache writes back as `connected`, so a working grant heals the entry on first use
    if (entry == null || credentials == null || entry.st === 'disconnected') {
      throw userExternalConnectionProviderNotConnectedError(providerType);
    }

    const { refreshToken } = credentials;

    // Cal.com issues an access token only in exchange for a refresh token, so without one there is
    // nothing to act with and no way to renew — a reconnect is the only remedy
    if (!refreshToken) {
      throw userExternalConnectionCredentialsExpiredError(providerType);
    }

    // the pair-backed cache, never the default: Cal.com invalidates a refresh token on every use and
    // hands the replacement to its cache, so any other cache leaves the stored token spent after one
    // use while the entry still reads `connected`
    const accessTokenCache = userExternalConnectionCalcomAccessTokenCache({ accessor, actions, uid });
    const userContext = calcomApi.makeUserContext({ refreshToken, accessTokenCache });

    const fetch = reportingFetch(uid, userContext.userFetch);
    // rebuilt over the wrapped fetch rather than wrapped itself, so the reporting cannot be bypassed
    // by whichever of the two an API function reaches for. The parse handling matches the Cal.com
    // factory's, which is what the unwrapped `userFetchJson` was built with
    const fetchJson = fetchJsonFunction(fetch, {
      handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction
    });

    const reportingContext: CalcomUserContext = {
      ...userContext,
      fetch,
      fetchJson,
      userFetch: fetch,
      userFetchJson: fetchJson
    };

    return calcomApi.makeContextInstance(reportingContext);
  }

  return { calcomUserContextForUser };
}
