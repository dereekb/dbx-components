import { ClientWebAppUrl } from './client';

export interface ClientAppConfig {
  clientWebAppUrl: ClientWebAppUrl;
}

export abstract class ClientAppServiceConfig {

  client!: ClientAppConfig;

  static assertValidConfig(config: ClientAppServiceConfig) {
    if (!config.client.clientWebAppUrl) {
      throw new Error('No client app url specified.');
    }
  }

}
