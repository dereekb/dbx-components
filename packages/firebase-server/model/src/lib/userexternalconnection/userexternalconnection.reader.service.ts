import { Logger } from '@nestjs/common';
import { MS_IN_MINUTE, type FactoryWithRequiredInput, type Maybe, type Milliseconds, expirationDetails } from '@dereekb/util';
import { safeToJsDate } from '@dereekb/date';
import { type FirebaseAuthUserId, type FirebaseAuthUserIdRef, type UserExternalConnectionEntry, type UserExternalConnectionErrorCode, type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { type UserExternalConnectionAccessor, type UserExternalConnectionForProvider, type UserExternalConnectionReadParams } from './userexternalconnection.accessor.service';
import { type UserExternalConnectionCredentials, mergeRefreshedUserExternalConnectionCredentials } from './userexternalconnection.private';
import { type UserExternalConnectionCredentialsRefresher } from './userexternalconnection.refresh.service';
import { type UserExternalConnectionCredentialsAndFailureWriter } from './userexternalconnection.action.server';
import { userExternalConnectionCredentialsExpiredError, userExternalConnectionProviderNotConnectedError } from './userexternalconnection.error';

/**
 * How long before its stated expiration a set of credentials is treated as already expired.
 *
 * A token that expires mid-flight is indistinguishable from one that was never valid, so the check
 * needs headroom. One minute matches the `tokenExpirationBuffer` default that the Cal.com and Zoho
 * token factories already use, so a credential this reader hands out is one those factories would also
 * consider live.
 */
export const DEFAULT_USER_EXTERNAL_CONNECTION_CREDENTIALS_EXPIRATION_BUFFER: Milliseconds = MS_IN_MINUTE;

/**
 * The error code recorded when a refresh attempt fails.
 *
 * `expired` rather than `revoked`: a failed refresh is nearly always `invalid_grant`, which does not
 * distinguish a revoked grant from a refresh token that was already spent, and claiming the user
 * revoked access when they did not would send the UI down the wrong path.
 */
export const DEFAULT_USER_EXTERNAL_CONNECTION_REFRESH_FAILURE_ERROR_CODE: UserExternalConnectionErrorCode = 'expired';

/**
 * Internal input for the reader's refresh path.
 *
 * Carries the entry the decision was made from so the failure path can tell whether the document
 * already records the failure it is about to write.
 */
interface RefreshCredentialsInput extends UserExternalConnectionReadParams {
  readonly previous: UserExternalConnectionCredentials;
  readonly entry: UserExternalConnectionEntry;
}

/**
 * Key identifying one user's connection to one provider, for deduping in-flight refreshes.
 *
 * @param params - The user and provider being read.
 * @returns The dedupe key.
 *
 * @__NO_SIDE_EFFECTS__
 */
function userExternalConnectionRefreshKey(params: UserExternalConnectionReadParams): string {
  return `${params.uid}:${params.providerType}`;
}

/**
 * Configuration for {@link userExternalConnectionReader}.
 */
export interface UserExternalConnectionReaderConfig {
  /**
   * The paired read surface this reader adds policy on top of.
   */
  readonly accessor: UserExternalConnectionAccessor;
  /**
   * Used to persist a refresh and to record a failure. Both go through the paired write.
   *
   * Narrowed to those two writes: a full `UserExternalConnectionServerActions` satisfies it, and
   * a caller wiring a reader over something else does not have to implement writes it never reaches.
   */
  readonly actions: UserExternalConnectionCredentialsAndFailureWriter;
  /**
   * Optional. Without one, expired credentials cannot be renewed and
   * {@link UserExternalConnectionReaderProviderInstance.readUsableUserExternalConnectionCredentials}
   * throws instead.
   */
  readonly refresher?: Maybe<UserExternalConnectionCredentialsRefresher>;
  /**
   * How long before its stated expiration a credential is treated as expired. Defaults to
   * {@link DEFAULT_USER_EXTERNAL_CONNECTION_CREDENTIALS_EXPIRATION_BUFFER}.
   */
  readonly expirationBuffer?: Maybe<Milliseconds>;
}

/**
 * Why a provider rejected a user's credentials.
 */
export interface UserExternalConnectionReportFailureInput {
  /**
   * Why the credentials were rejected. Defaults to `unauthorized`, the code for the 401 this is
   * almost always called in response to.
   */
  readonly error?: Maybe<UserExternalConnectionErrorCode>;
}

/**
 * Parameters for reporting that a provider rejected a user's credentials.
 */
export interface UserExternalConnectionReportFailureParams extends UserExternalConnectionReadParams, UserExternalConnectionReportFailureInput {}

/**
 * Input identifying the user a {@link UserExternalConnectionReaderUserInstance} reads for.
 */
export interface UserExternalConnectionReaderUserInput extends FirebaseAuthUserIdRef {}

/**
 * A {@link UserExternalConnectionReader} narrowed to ONE user and ONE provider.
 *
 * The reader's entire read surface, with `{ uid, providerType }` already applied — so a consumer acting
 * as one user against one provider, the normal case for code making provider API calls, states that
 * pair once instead of at every call and cannot accidentally mix two providers up.
 */
export interface UserExternalConnectionReaderProviderInstance {
  readonly uid: FirebaseAuthUserId;
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * Loads both halves of the pair, applying no policy. Never throws for an absent or unusable
   * connection.
   */
  readUserExternalConnectionForProvider(): Promise<UserExternalConnectionForProvider>;
  /**
   * Loads the stored credentials as-is, applying no policy. They may be expired.
   */
  readUserExternalConnectionCredentials(): Promise<Maybe<UserExternalConnectionCredentials>>;
  /**
   * Returns credentials that are safe to attempt a provider call with, renewing them first if needed.
   *
   * @throws When the user is not connected to the provider, or the credentials have expired and could
   *   not be renewed.
   */
  readUsableUserExternalConnectionCredentials(): Promise<UserExternalConnectionCredentials>;
  /**
   * Records that the provider rejected these credentials, moving the entry to the `error` status.
   *
   * Exists so a caller that gets a 401 mid-call can report it without reaching for the write surface.
   * Never throws — a failure to record a failure is logged and swallowed, because the caller is already
   * handling an error and losing that error to this one would be worse.
   *
   * @param input - Why the credentials were rejected. Defaults to `unauthorized`.
   */
  reportUserExternalConnectionFailure(input?: Maybe<UserExternalConnectionReportFailureInput>): Promise<void>;
}

/**
 * A {@link UserExternalConnectionReader} narrowed to one user, awaiting the provider to target.
 *
 * The second of the reader's two factory levels. Splitting them this way is what lets ONE reader — the
 * app has a single provider-agnostic instance — be narrowed to a user once and then used against any
 * number of that user's providers.
 */
export type UserExternalConnectionReaderUserInstance = FactoryWithRequiredInput<UserExternalConnectionReaderProviderInstance, UserExternalConnectionProviderType>;

/**
 * Reads a user's third-party credentials for a specific provider, and keeps them usable.
 *
 * The read surface a consumer should reach for. It wraps a {@link UserExternalConnectionAccessor} and
 * adds the policy that would otherwise be re-implemented at every call site: whether the connection is
 * usable, whether the credentials are near enough to expiring to renew, renewing them, persisting the
 * result, and recording a failure.
 *
 * A consumer that has this does not need `UserExternalConnectionServerActions` at all, which is
 * the point — that class is the write surface.
 */
export abstract class UserExternalConnectionReader {
  /**
   * Narrows this reader to one user, returning a factory that narrows it further to one provider.
   *
   * The reader's only entry point. Every read and the failure report live on the narrowed instance, so
   * a caller states the user and provider it is acting for once instead of threading that pair through
   * each call:
   *
   * ```ts
   * const connections = reader.readerForUser({ uid });
   * const credentials = await connections(CALCOM).readUsableUserExternalConnectionCredentials();
   * ```
   *
   * @param input - The user to read for.
   * @returns A factory producing a reader for whichever of that user's providers is needed.
   */
  abstract readerForUser(input: UserExternalConnectionReaderUserInput): UserExternalConnectionReaderUserInstance;
}

/**
 * Reference to a {@link UserExternalConnectionReader} instance.
 */
export interface UserExternalConnectionReaderRef {
  readonly userExternalConnectionReader: UserExternalConnectionReader;
}

/**
 * Creates a {@link UserExternalConnectionReader}.
 *
 * @param config - The accessor and actions to build over, plus the optional refresher.
 * @returns A concrete UserExternalConnectionReader implementation.
 */
export function userExternalConnectionReader(config: UserExternalConnectionReaderConfig): UserExternalConnectionReader {
  const { accessor, actions, refresher } = config;
  const expirationBuffer = config.expirationBuffer ?? DEFAULT_USER_EXTERNAL_CONNECTION_CREDENTIALS_EXPIRATION_BUFFER;
  const logger = new Logger('UserExternalConnectionReader');

  /**
   * In-flight refreshes, keyed by user and provider.
   *
   * Without this, two concurrent calls that both find an expired credential both refresh, and for a
   * provider that ROTATES its refresh token (Cal.com invalidates the token each use) the second
   * exchange is sent with a token the first already spent — so one of two valid grants is destroyed
   * and the loser's write leaves a dead token stored.
   *
   * This is process-local. Two Cloud Function instances refreshing the same connection at the same
   * instant still race, and the paired write is last-write-wins. Narrowing that further would need a
   * lease in Firestore; the window is small enough, and the failure recoverable by a reconnect, that
   * it is deliberately left open rather than paid for on every read.
   */
  const inFlightRefreshes = new Map<string, Promise<UserExternalConnectionCredentials>>();

  /**
   * Whether these credentials are close enough to expiring that they should not be handed out.
   *
   * Credentials with NO stated expiration are usable, not expired — some providers issue long-lived
   * tokens and simply do not say when they end. That is why `defaultExpiresFromDateToNow` is false:
   * left at its default, a missing expiration would resolve to `now - buffer` and read as expired.
   *
   * @param credentials - The credentials to check.
   * @param now - The instant to compare against. Defaults to the current time.
   * @returns True when the credentials are expired or expire inside the leeway window.
   */
  function credentialsAreExpired(credentials: UserExternalConnectionCredentials, now?: Maybe<Date>): boolean {
    return expirationDetails({
      expiresFromDate: safeToJsDate(credentials.expiresAt),
      expiresIn: -expirationBuffer,
      defaultExpiresFromDateToNow: false,
      now
    }).hasExpired();
  }

  async function refreshAndPersistCredentials(input: RefreshCredentialsInput): Promise<UserExternalConnectionCredentials> {
    const { uid, providerType, previous, entry } = input;

    try {
      // the two ways renewal can be unavailable are treated identically. Both leave the user with
      // credentials that cannot be used and a reconnect as the only remedy, so distinguishing them in
      // the stored entry would describe OUR configuration rather than the state of their connection.
      if (refresher == null) {
        throw userExternalConnectionCredentialsExpiredError(providerType);
      }

      const refreshed = await refresher.refreshUserExternalConnectionCredentials({ uid, providerType, credentials: previous });

      if (refreshed == null) {
        // the provider is registered but declares no refresh path, so there is nothing to renew with
        logger.warn(`No refresh path is available for "${providerType}"; uid "${uid}" must reconnect.`);
        throw userExternalConnectionCredentialsExpiredError(providerType);
      }

      // the paired write replaces the provider's credentials wholesale, so anything the refresh
      // response omitted has to be carried forward here or it is erased
      const credentials = mergeRefreshedUserExternalConnectionCredentials({ previous, refreshed });
      await actions.refreshUserExternalConnectionCredentials({ uid, providerType, credentials });
      logger.log(`Refreshed the "${providerType}" credentials for uid "${uid}".`);

      return credentials;
    } catch (e) {
      // leaving the entry `connected` after its refresh failed would present a connection that cannot
      // be used and does not look broken — the exact state this framework exists to make impossible.
      // Skipped when the entry ALREADY records this, so a hot read path against an unrenewable
      // connection does not write a transaction per call to say what the document already says.
      if (entry.st !== 'error' || entry.er !== DEFAULT_USER_EXTERNAL_CONNECTION_REFRESH_FAILURE_ERROR_CODE) {
        await reportUserExternalConnectionFailure({ uid, providerType, error: DEFAULT_USER_EXTERNAL_CONNECTION_REFRESH_FAILURE_ERROR_CODE });
      }

      throw e;
    }
  }

  function refreshCredentialsOnce(input: RefreshCredentialsInput): Promise<UserExternalConnectionCredentials> {
    const key = userExternalConnectionRefreshKey(input);
    let result = inFlightRefreshes.get(key);

    if (result == null) {
      result = refreshAndPersistCredentials(input).finally(() => {
        inFlightRefreshes.delete(key);
      });

      inFlightRefreshes.set(key, result);
    }

    return result;
  }

  async function readUsableUserExternalConnectionCredentials(params: UserExternalConnectionReadParams): Promise<UserExternalConnectionCredentials> {
    const { uid, providerType } = params;
    const { entry, credentials } = await accessor.accessorForUser({ uid })(providerType).readUserExternalConnectionForProvider();

    // an absent entry, an absent set of credentials, or an explicit disconnect all mean the same thing
    // to a caller: there is nothing here to act with, and the remedy is for the user to connect
    if (entry == null || credentials == null || entry.st === 'disconnected') {
      throw userExternalConnectionProviderNotConnectedError(providerType);
    }

    // an `error` entry keeps its credentials precisely so a refresh can repair it, so try that when
    // there is something to try with. When there is not, the stored credentials are still handed over
    // if they have not expired: the recorded error may have been a scope refusal that leaves them
    // usable for other calls, and refusing to try would be less useful than letting the caller find out
    const expired = credentialsAreExpired(credentials);
    const shouldRefresh = expired || (entry.st === 'error' && refresher != null);

    return shouldRefresh ? refreshCredentialsOnce({ ...params, previous: credentials, entry }) : credentials;
  }

  async function reportUserExternalConnectionFailure(params: UserExternalConnectionReportFailureParams): Promise<void> {
    const { uid, providerType, error } = params;

    await actions.markUserExternalConnectionError({ uid, providerType, error: error ?? 'unauthorized' }).catch((markError: unknown) => {
      logger.error(`Failed marking the "${providerType}" connection error for uid "${uid}": `, markError);
    });
  }

  function readerForUser(input: UserExternalConnectionReaderUserInput): UserExternalConnectionReaderUserInstance {
    const { uid } = input;

    const accessorForUser = accessor.accessorForUser({ uid });

    return (providerType) => {
      const params: UserExternalConnectionReadParams = { uid, providerType };
      // the raw reads are the accessor's, narrowed the same way — this tier only adds the policy
      const accessorForProvider = accessorForUser(providerType);

      return {
        uid,
        providerType,
        readUserExternalConnectionForProvider: () => accessorForProvider.readUserExternalConnectionForProvider(),
        readUserExternalConnectionCredentials: () => accessorForProvider.readUserExternalConnectionCredentials(),
        readUsableUserExternalConnectionCredentials: () => readUsableUserExternalConnectionCredentials(params),
        reportUserExternalConnectionFailure: (failureInput) => reportUserExternalConnectionFailure({ ...params, error: failureInput?.error })
      };
    };
  }

  return {
    readerForUser
  };
}
