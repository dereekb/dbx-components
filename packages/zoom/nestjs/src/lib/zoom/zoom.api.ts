import { Inject, Injectable } from '@nestjs/common';
import { ZoomServiceConfig } from './zoom.config';
import { Zoom, ZoomContext, zoomFactory } from '@dereekb/zoom';
import { ZoomOAuthApi } from '../oauth';

@Injectable()
export class ZoomApi {
  readonly zoom: Zoom;

  get zoomContext(): ZoomContext {
    return this.zoom.zoomContext;
  }

  get zoomRateLimiter() {
    return this.zoom.zoomContext.zoomRateLimiter;
  }

  constructor(
    @Inject(ZoomServiceConfig) readonly config: ZoomServiceConfig,
    @Inject(ZoomOAuthApi) readonly zoomOAuthApi: ZoomOAuthApi
  ) {
    this.zoom = zoomFactory({
      ...config.factoryConfig,
      oauthContext: zoomOAuthApi.oauthContext
    })(config.zoom);
  }

  // MARK: Accessors

  // TODO: ...
}
