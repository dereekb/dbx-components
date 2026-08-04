import { Inject, Injectable } from '@nestjs/common';
import { type ZoomOAuth, type ZoomOAuthContext, serverAccessToken, userAccessToken, zoomOAuthFactory } from '@dereekb/zoom';
import { ZoomOAuthServiceConfig } from './oauth.config';
import { ZoomOAuthAccessTokenCacheService } from './oauth.service';

@Injectable()
export class ZoomOAuthApi {
  readonly zoomOAuth: ZoomOAuth;

  get oauthContext(): ZoomOAuthContext {
    return this.zoomOAuth.oauthContext;
  }

  constructor(
    @Inject(ZoomOAuthServiceConfig) readonly config: ZoomOAuthServiceConfig,
    @Inject(ZoomOAuthAccessTokenCacheService) readonly cacheService: ZoomOAuthAccessTokenCacheService
  ) {
    const { clientId, clientSecret, accountId } = config.zoomOAuth;
    const accessTokenCache = config.zoomOAuth.accessTokenCache ?? cacheService.loadZoomAccessTokenCache();

    // the fields the OAuth context needs are named rather than spread: the spread used to come AFTER
    // `accessTokenCache`, so a present-but-undefined key on the service config would overwrite the
    // cache just resolved from the cache service
    this.zoomOAuth = zoomOAuthFactory(config.factoryConfig ?? {})({ clientId, clientSecret, accountId, accessTokenCache });
  }

  // MARK: Accessors
  get serverAccessToken() {
    return serverAccessToken(this.oauthContext);
  }

  get userAccessToken() {
    return userAccessToken(this.oauthContext);
  }
}
