import { Injectable } from '@nestjs/common';
import { ClientWebAppHost, ClientWebAppUrl } from './client';
import { ClientAppServiceConfig } from './client.config';

/**
 * Provides information about companion apps and websites for the project.
 */
@Injectable()
export class ClientAppService {
  private _config: ClientAppServiceConfig;

  constructor(config: ClientAppServiceConfig) {
    this._config = config;
  }

  get config() {
    return this._config;
  }

  get webAppUrl(): ClientWebAppUrl {
    return this.config.client.clientWebAppUrl;
  }

  get webAppHost(): ClientWebAppHost {
    return this.webAppUrl.split('://', 2)[1];
  }
}
