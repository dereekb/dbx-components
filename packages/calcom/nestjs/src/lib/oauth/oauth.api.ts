import { Inject, Injectable } from '@nestjs/common';
import { type CalcomAccessTokenCache, type CalcomOAuth, type CalcomOAuthContext, type CalcomRefreshToken, calcomOAuthFactory, exchangeAuthorizationCode } from '@dereekb/calcom';
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

    this.calcomOAuth = calcomOAuthFactory(config.factoryConfig ?? {})({
      accessTokenCache,
      clientId: clientId ?? '',
      clientSecret: clientSecret ?? '',
      refreshToken,
      apiKey
    });
  }

  // MARK: Accessors
  /**
   * Configured pass-through for {@link exchangeAuthorizationCode}.
   *
   * @returns function to exchange an OAuth authorization code for tokens
   */
  get exchangeAuthorizationCode() {
    return exchangeAuthorizationCode(this.oauthContext);
  }

  /**
   * Retrieves an access token for a specific user using their refresh token.
   *
   * @param input - contains the user's refresh token and optional access token cache
   * @param input.refreshToken - the user's OAuth refresh token
   * @param input.userAccessTokenCache - optional cache to store/retrieve the user's access token
   * @returns a promise resolving to the user's CalcomAccessToken
   */
  userAccessToken(input: { refreshToken: string; userAccessTokenCache?: Maybe<CalcomAccessTokenCache> }) {
    const factory = this.oauthContext.makeUserAccessTokenFactory(input);
    return factory();
  }

  /**
   * Returns a per-user CalcomAccessTokenCache derived from the refresh token (md5 hashed as the file key).
   * Returns undefined if the cache service does not support per-user caching.
   *
   * @param refreshToken - the user's OAuth refresh token used to derive the cache key
   * @returns a per-user access token cache, or undefined if not supported
   */
  cacheForRefreshToken(refreshToken: CalcomRefreshToken): Maybe<CalcomAccessTokenCache> {
    return this.cacheService.cacheForRefreshToken?.(refreshToken);
  }
}
