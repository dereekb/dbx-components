import { Inject, Injectable } from '@nestjs/common';
import { type CalcomAccessToken, type CalcomAccessTokenCache, type CalcomAccessTokenCacheKey, type CalcomAccessTokenFactory, type CalcomOAuth, type CalcomOAuthContext, type CalcomOAuthExchangeAuthorizationCodeInput, type CalcomOAuthMakeUserAccessTokenFactoryInput, type CalcomRefreshToken, calcomAccessTokenFromTokenResponse, calcomOAuthFactory, exchangeAuthorizationCode } from '@dereekb/calcom';
import { type Maybe } from '@dereekb/util';
import { CalcomOAuthServiceConfig } from './oauth.config';
import { CalcomOAuthAccessTokenCacheService } from './oauth.service';

@Injectable()
export class CalcomOAuthApi {
  readonly calcomOAuth: CalcomOAuth;

  /**
   * Per-user token factories, memoized by their caller-owned key so each user's in-memory token
   * tier is reused across calls.
   */
  private readonly _userAccessTokenFactories = new Map<CalcomAccessTokenCacheKey, CalcomAccessTokenFactory>();

  get oauthContext(): CalcomOAuthContext {
    return this.calcomOAuth.oauthContext;
  }

  constructor(
    @Inject(CalcomOAuthServiceConfig) readonly config: CalcomOAuthServiceConfig,
    @Inject(CalcomOAuthAccessTokenCacheService) readonly cacheService: CalcomOAuthAccessTokenCacheService
  ) {
    const accessTokenCache = cacheService.loadCalcomAccessTokenCache();
    const { clientId, clientSecret, refreshToken, apiKey } = config.calcomOAuth;

    // the environment-facing config stays flat, mirroring the CALCOM_* variables it is read from, and
    // is mapped here into the two roles the context actually distinguishes. The client is taken as a
    // pair or not at all, which replaces the empty-string sentinels this used to pass for a
    // configuration that has no OAuth client
    this.calcomOAuth = calcomOAuthFactory(config.factoryConfig ?? {})({
      serverAuth: { apiKey, refreshToken, accessTokenCache },
      client: clientId && clientSecret ? { clientId, clientSecret } : undefined
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
   * When a `key` is provided the produced factory is memoized against it, so repeat calls share
   * the factory's in-memory token tier instead of falling through to the cache or a live refresh
   * on every call.
   *
   * @param input - Contains the user's refresh token, an optional memoization key, and an optional access token cache.
   * @returns Promise resolving to the user's CalcomAccessToken.
   */
  userAccessToken(input: CalcomOAuthMakeUserAccessTokenFactoryInput): Promise<CalcomAccessToken> {
    return this.userAccessTokenFactory(input)();
  }

  /**
   * Returns the memoized per-user CalcomAccessTokenFactory for the given input.
   *
   * Without a `key` the factory cannot be shared (there is nothing stable to memoize against), so
   * a fresh one is returned and its in-memory tier lives only for that call.
   *
   * @param input - Contains the user's refresh token, an optional memoization key, and an optional access token cache.
   * @returns The CalcomAccessTokenFactory for that user.
   */
  userAccessTokenFactory(input: CalcomOAuthMakeUserAccessTokenFactoryInput): CalcomAccessTokenFactory {
    const { key } = input;
    let factory: Maybe<CalcomAccessTokenFactory>;

    if (key == null) {
      factory = this.oauthContext.makeUserAccessTokenFactory(input);
    } else {
      factory = this._userAccessTokenFactories.get(key);

      if (factory == null) {
        factory = this.oauthContext.makeUserAccessTokenFactory(input);
        this._userAccessTokenFactories.set(key, factory);
      }
    }

    return factory;
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
