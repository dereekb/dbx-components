import { type ZohoCrmConfig, type ZohoCrmFactoryConfig } from '@dereekb/zoho';
import { assertValidZohoConfig } from '../zoho.config';

export type ZohoCrmServiceApiConfig = ZohoCrmConfig & {};

/**
 * Configuration for ZohoCrmService
 */
export abstract class ZohoCrmServiceConfig {
  readonly zohoCrm!: ZohoCrmServiceApiConfig;
  readonly factoryConfig?: ZohoCrmFactoryConfig;

  static assertValidConfig(config: ZohoCrmServiceConfig) {
    assertValidZohoConfig(config.zohoCrm);
  }
}
