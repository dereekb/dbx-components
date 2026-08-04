import { ZOHO_OAUTH_SCOPE_DELIMITER, type ZohoAccessToken, type ZohoAccessTokenCache } from '@dereekb/zoho';
import { ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, type FirebaseAuthUserId } from '@dereekb/firebase';
import { type UserExternalConnectionAccessor, type UserExternalConnectionCredentials, type UserExternalConnectionCredentialsWriter, mergeRefreshedUserExternalConnectionCredentials } from '@dereekb/firebase-server/model';
import { MS_IN_SECOND, type Maybe, type Seconds } from '@dereekb/util';
import { safeToJsDate } from '@dereekb/date';
import { ZOHO_EXTRA_API_DOMAIN_KEY } from './zoho.oauth.connection.service';

/**
 * Maps stored connection credentials to a {@link ZohoAccessToken}.
 *
 * @param credentials - The credentials stored for the `zoho` provider.
 * @returns The equivalent Zoho access token, or null when the credentials cannot form one.
 */
export function zohoAccessTokenFromUserExternalConnectionCredentials(credentials: Maybe<UserExternalConnectionCredentials>): Maybe<ZohoAccessToken> {
  const expiresAt = safeToJsDate(credentials?.expiresAt);
  const apiDomain = credentials?.extra?.[ZOHO_EXTRA_API_DOMAIN_KEY];
  let result: Maybe<ZohoAccessToken>;

  // the api domain is required, not incidental: a Zoho access token is only usable against the domain
  // it was issued for, so a token synthesized without one would be sent to the wrong host
  if (credentials != null && expiresAt != null && apiDomain != null) {
    const issuedAt = safeToJsDate(credentials.issuedAt);
    const expiresIn: Seconds = Math.round((expiresAt.getTime() - (issuedAt?.getTime() ?? Date.now())) / MS_IN_SECOND);

    result = {
      accessToken: credentials.accessToken,
      // joined on the same delimiter `zohoOAuthScopesFromScopeString` split them with
      scope: (credentials.scopes ?? []).join(ZOHO_OAUTH_SCOPE_DELIMITER),
      apiDomain: String(apiDomain),
      expiresIn,
      expiresAt
    };
  }

  return result;
}

/**
 * Configuration for {@link userExternalConnectionZohoAccessTokenCache}.
 */
export interface UserExternalConnectionZohoAccessTokenCacheConfig {
  /**
   * Used to read the user's currently stored Zoho credentials.
   *
   * The accessor rather than `UserExternalConnectionReader`: the contract below is explicitly that an
   * EXPIRED token may be returned, so a surface that could refresh would be the wrong tool — see
   * `loadCachedToken`.
   */
  readonly accessor: UserExternalConnectionAccessor;
  /**
   * Used to persist a renewed token back onto the connection pair, and to record a cleared one.
   */
  readonly actions: UserExternalConnectionCredentialsWriter;
  readonly uid: FirebaseAuthUserId;
}

/**
 * Creates a {@link ZohoAccessTokenCache} backed by a user's UserExternalConnection pair.
 *
 * The Zoho counterpart of `userExternalConnectionCalcomAccessTokenCache`, and the per-user counterpart
 * of `firebaseZohoAccountsAccessTokenCacheService` — which caches the APP's token in a `SystemState`
 * document and has no notion of a user.
 *
 * Zoho does not rotate refresh tokens, so unlike Cal.com there is no token here that is destroyed by
 * being used. What this buys instead is that a renewed access token is shared: without it every Cloud
 * Function instance holds its own in-memory token and refreshes independently, so a user's grant is
 * exercised once per instance per hour rather than once per hour.
 *
 * @param config - The accessor, the actions, and the user the cache is for.
 * @returns A ZohoAccessTokenCache reading and writing the user's connection pair.
 */
export function userExternalConnectionZohoAccessTokenCache(config: UserExternalConnectionZohoAccessTokenCacheConfig): ZohoAccessTokenCache {
  const { accessor, actions, uid } = config;
  const providerType = ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE;
  const connection = accessor.accessorForUser({ uid })(providerType);

  async function loadCachedToken(): Promise<Maybe<ZohoAccessToken>> {
    // the raw read: this cache is consulted by Zoho's own factory BEFORE it decides to refresh, and its
    // contract is explicitly that the returned token may be expired
    const credentials = await connection.readUserExternalConnectionCredentials();
    return zohoAccessTokenFromUserExternalConnectionCredentials(credentials);
  }

  async function updateCachedToken(accessToken: ZohoAccessToken): Promise<void> {
    const previous = await connection.readUserExternalConnectionCredentials();

    if (previous == null) {
      // nothing to merge onto, and a Zoho access token carries no refresh token — writing it alone
      // would store credentials that can never be renewed
      return;
    }

    const now = new Date();

    const refreshed: UserExternalConnectionCredentials = {
      ...previous,
      accessToken: accessToken.accessToken,
      issuedAt: now.toISOString(),
      expiresAt: accessToken.expiresAt.toISOString(),
      extra: { ...previous.extra, [ZOHO_EXTRA_API_DOMAIN_KEY]: accessToken.apiDomain }
    };

    await actions.refreshUserExternalConnectionCredentials({ uid, providerType, credentials: mergeRefreshedUserExternalConnectionCredentials({ previous, refreshed }) });
  }

  async function clearCachedToken(): Promise<void> {
    const previous = await connection.readUserExternalConnectionCredentials();

    if (previous == null) {
      return;
    }

    // deliberately NOT a disconnect. Zoho's factory clears the cache to force its next call to refresh,
    // which is a statement about the ACCESS token only — dropping the refresh token here would turn a
    // routine cache invalidation into a connection the user has to re-authorize.
    await actions.refreshUserExternalConnectionCredentials({
      uid,
      providerType,
      credentials: { ...previous, accessToken: '', expiresAt: new Date(0).toISOString() }
    });
  }

  return { loadCachedToken, updateCachedToken, clearCachedToken };
}
