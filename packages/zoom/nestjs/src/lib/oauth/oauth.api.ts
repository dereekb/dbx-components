import { Inject, Injectable } from '@nestjs/common';
import { ZoomOAuth, ZoomOAuthContext, serverAccessToken, userAccessToken, zoomOAuthFactory } from '@dereekb/zoom';
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
    const accessTokenCache = config.zoomOAuth.accessTokenCache ? config.zoomOAuth.accessTokenCache : cacheService.loadZoomAccessTokenCache();
    this.zoomOAuth = zoomOAuthFactory(config.factoryConfig ?? {})({
      accessTokenCache,
      ...config.zoomOAuth
    });
  }

  // MARK: Accessors
  get serverAccessToken() {
    return serverAccessToken(this.oauthContext);
  }

  get userAccessToken() {
    return userAccessToken(this.oauthContext);
  }
}
