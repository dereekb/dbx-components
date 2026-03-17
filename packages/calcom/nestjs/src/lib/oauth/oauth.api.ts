import { Inject, Injectable } from '@nestjs/common';
import { type CalcomOAuth, type CalcomOAuthContext, calcomOAuthFactory, exchangeAuthorizationCode } from '@dereekb/calcom';
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
  get exchangeAuthorizationCode() {
    return exchangeAuthorizationCode(this.oauthContext);
  }

  userAccessToken(input: { refreshToken: string }) {
    const factory = this.oauthContext.makeUserAccessTokenFactory(input);
    return factory();
  }
}
