import { CALCOM_OAUTH_SCOPE_DELIMITER, type CalcomAccessToken, type CalcomAccessTokenCache } from '@dereekb/calcom';
import { CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, type FirebaseAuthUserId } from '@dereekb/firebase';
import { type UserExternalConnectionCredentials, type UserExternalConnectionReader, type UserExternalConnectionServerActions, mergeRefreshedUserExternalConnectionCredentials } from '@dereekb/firebase-server/model';
import { MS_IN_SECOND, type Maybe, type Seconds } from '@dereekb/util';
import { safeToJsDate } from '@dereekb/date';
import { calcomUserExternalConnectionCredentials } from './calcom.oauth.connection.service';

/**
 * Maps stored connection credentials to a {@link CalcomAccessToken}.
 *
 * @param credentials - The credentials stored for the `calcom` provider.
 * @returns The equivalent Cal.com access token, or null when the credentials cannot form one.
 */
export function calcomAccessTokenFromUserExternalConnectionCredentials(credentials: Maybe<UserExternalConnectionCredentials>): Maybe<CalcomAccessToken> {
  const expiresAt = safeToJsDate(credentials?.expiresAt);
  let result: Maybe<CalcomAccessToken>;

  // Cal.com's token type requires all four, and its factory reads `expiresAt` to decide whether to
  // refresh — a token synthesized without one would be treated as valid forever
  if (credentials?.refreshToken && expiresAt != null) {
    const issuedAt = safeToJsDate(credentials.issuedAt);
    const expiresIn: Seconds = Math.round((expiresAt.getTime() - (issuedAt?.getTime() ?? Date.now())) / MS_IN_SECOND);

    result = {
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      // re-joined on the delimiter the authorize request splits on, so the round trip stays symmetric
      scope: (credentials.scopes ?? []).join(CALCOM_OAUTH_SCOPE_DELIMITER),
      expiresIn,
      expiresAt
    };
  }

  return result;
}

/**
 * Configuration for {@link userExternalConnectionCalcomAccessTokenCache}.
 */
export interface UserExternalConnectionCalcomAccessTokenCacheConfig {
  /**
   * Used to read the user's currently stored Cal.com credentials.
   */
  readonly reader: UserExternalConnectionReader;
  /**
   * Used to persist a rotated token back onto the connection pair.
   */
  readonly actions: UserExternalConnectionServerActions;
  readonly uid: FirebaseAuthUserId;
}

/**
 * Creates a {@link CalcomAccessTokenCache} backed by a user's UserExternalConnection pair.
 *
 * This is what keeps a Cal.com connection working past its first refresh. Cal.com invalidates a
 * refresh token on every use and returns a rotated one, but it hands that rotated token to its
 * `CalcomAccessTokenCache` — not back to us. With the default in-memory or file cache, the token
 * stored on `uecp` is spent the first time it is used: nothing looks wrong, the entry stays
 * `connected`, and the next process that starts with a cold cache replays a dead token.
 *
 * Pointing the cache at the connection pair makes the pair the single store of record, so a rotation
 * is durable the moment it happens.
 *
 * Deliberately NOT registered as a `CalcomOAuthAccessTokenCacheService`: that service's `cacheForKey`
 * is keyed by an opaque string, whereas this cache is per-user and needs a uid. Build one per user at
 * the call site and pass it in explicitly.
 *
 * @param config - The reader, the actions, and the user the cache is for.
 * @returns A CalcomAccessTokenCache reading and writing the user's connection pair.
 */
export function userExternalConnectionCalcomAccessTokenCache(config: UserExternalConnectionCalcomAccessTokenCacheConfig): CalcomAccessTokenCache {
  const { reader, actions, uid } = config;
  const providerType = CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE;

  async function loadCachedToken(): Promise<Maybe<CalcomAccessToken>> {
    // the raw read, not `readUsableUserExternalConnectionCredentials`: this cache is what Cal.com's own
    // factory consults BEFORE deciding to refresh, and the contract is explicitly that the returned
    // token may be expired. Renewing here would pre-empt the caller's own refresh path and could
    // recurse back into it.
    const credentials = await reader.readUserExternalConnectionCredentials({ uid, providerType });
    return calcomAccessTokenFromUserExternalConnectionCredentials(credentials);
  }

  async function updateCachedToken(accessToken: CalcomAccessToken): Promise<void> {
    const previous = await reader.readUserExternalConnectionCredentials({ uid, providerType });
    const refreshed = calcomUserExternalConnectionCredentials(accessToken);

    // merged rather than written verbatim, because the paired write replaces the provider's credentials
    // wholesale and Cal.com's token carries no account id or label
    const credentials = previous == null ? refreshed : mergeRefreshedUserExternalConnectionCredentials({ previous, refreshed });

    await actions.refreshUserExternalConnectionCredentials({ uid, providerType, credentials });
  }

  return { loadCachedToken, updateCachedToken };
}
