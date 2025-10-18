import { type ClientWebAppUrl } from './client';

export interface ClientAppConfig {
  readonly clientWebAppUrl: ClientWebAppUrl;
}

export abstract class ClientAppServiceConfig {
  readonly client!: ClientAppConfig;

  static assertValidConfig(config: ClientAppServiceConfig) {
    if (!config.client.clientWebAppUrl) {
      throw new Error('No client app url specified.');
    }
  }
}
