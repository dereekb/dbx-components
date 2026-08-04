import { Inject, Injectable } from '@nestjs/common';
import { type CalcomAccessToken, type CalcomAccessTokenCache, type CalcomAccessTokenCacheKey, type CalcomAccessTokenFactory, type CalcomOAuth, type CalcomOAuthContext, type CalcomOAuthExchangeAuthorizationCodeInput, type CalcomRefreshToken, type CalcomRefreshTokenCredential, calcomAccessTokenFromTokenResponse, calcomAuthCredentialFromValues, calcomOAuthFactory, exchangeAuthorizationCode } from '@dereekb/calcom';
import { type Maybe } from '@dereekb/util';
import { CalcomOAuthServiceConfig } from './oauth.config';
import { CalcomOAuthAccessTokenCacheService } from './oauth.service';

@Injectable()
export class CalcomOAuthApi {
  readonly calcomOAuth: CalcomOAuth;

  get oauthContext(): CalcomOAuthContext {
    return this.calcomOAuth.oauthContext;
  }

  constructor(
    @Inject(CalcomOAuthServiceConfig) readonly config: CalcomOAuthServiceConfig,
    @Inject(CalcomOAuthAccessTokenCacheService) readonly cacheService: CalcomOAuthAccessTokenCacheService
  ) {
    const accessTokenCache = cacheService.loadCalcomAccessTokenCache();
    const { clientId, clientSecret, refreshToken, apiKey } = config.calcomOAuth;

    // the environment-facing config stays flat, mirroring the CALCOM_* variables it is read from.
    // `client` is the app's OAuth registration, sent on every exchange; `defaultAuth` is the one
    // credential the ambient loadAccessToken() resolves. The client is taken as a pair or not at all,
    // which replaces the empty-string sentinels this used to pass for a config with no OAuth client
    this.calcomOAuth = calcomOAuthFactory(config.factoryConfig ?? {})({
      client: clientId && clientSecret ? { clientId, clientSecret } : undefined,
      defaultAuth: calcomAuthCredentialFromValues({ apiKey, refreshToken, accessTokenCache })
    });
  }

  // MARK: Accessors
  /**
   * Configured pass-through for {@link exchangeAuthorizationCode}.
   *
   * @returns Function to exchange an OAuth authorization code for tokens.
   */
  get exchangeAuthorizationCode() {
    return exchangeAuthorizationCode(this.oauthContext);
  }

  /**
   * Exchanges an OAuth authorization code and maps the response to a {@link CalcomAccessToken}.
   *
   * The returned `refreshToken` is the one to persist: Cal.com rotates refresh tokens on every use.
   *
   * @param input - The authorization code and the exact redirect URI it was issued for.
   * @returns The exchanged access token.
   */
  async exchangeAuthorizationCodeToAccessToken(input: CalcomOAuthExchangeAuthorizationCodeInput): Promise<CalcomAccessToken> {
    const response = await this.exchangeAuthorizationCode(input);
    return calcomAccessTokenFromTokenResponse(response);
  }

  /**
   * Retrieves an access token for a specific user using their refresh token.
   *
   * @param credential - The user's refresh token credential, with the cache scoped to that grant.
   * @returns Promise resolving to the user's CalcomAccessToken.
   */
  userAccessToken(credential: CalcomRefreshTokenCredential): Promise<CalcomAccessToken> {
    return this.userAccessTokenFactory(credential)();
  }

  /**
   * Returns the CalcomAccessTokenFactory for a user's credential.
   *
   * A fresh factory on every call: its in-memory tier lives only as long as the returned factory, so
   * one caller's tokens are never visible to the next. Durable sharing is the access token cache's
   * job — see {@link cacheForKey}.
   *
   * @param credential - The user's refresh token credential.
   * @returns The CalcomAccessTokenFactory for that credential.
   */
  userAccessTokenFactory(credential: CalcomRefreshTokenCredential): CalcomAccessTokenFactory {
    return this.oauthContext.makeAccessTokenFactory(credential);
  }

  /**
   * Returns a per-user CalcomAccessTokenCache for a stable, caller-owned key.
   * Returns undefined if the cache service does not support keyed caching.
   *
   * Preferred over {@link cacheForRefreshToken}, whose key changes as Cal.com rotates the token.
   *
   * @param key - A stable key identifying the user, such as their user or profile id.
   * @returns A per-user access token cache, or undefined if not supported.
   */
  cacheForKey(key: CalcomAccessTokenCacheKey): Maybe<CalcomAccessTokenCache> {
    return this.cacheService.cacheForKey?.(key);
  }

  /**
   * Returns a per-user CalcomAccessTokenCache derived from a hash of the refresh token.
   * Returns undefined if the cache service does not support per-user caching.
   *
   * @param refreshToken - The user's OAuth refresh token used to derive the cache key.
   * @returns A per-user access token cache, or undefined if not supported.
   */
  cacheForRefreshToken(refreshToken: CalcomRefreshToken): Maybe<CalcomAccessTokenCache> {
    return this.cacheService.cacheForRefreshToken?.(refreshToken);
  }
}
