import { type ZohoSignConfig, type ZohoSignFactoryConfig } from '@dereekb/zoho';
import { assertValidZohoConfig } from '../zoho.config';

export type ZohoSignServiceApiConfig = ZohoSignConfig & {};

/**
 * Configuration for ZohoSignService
 */
export abstract class ZohoSignServiceConfig {
  readonly zohoSign!: ZohoSignServiceApiConfig;
  readonly factoryConfig?: ZohoSignFactoryConfig;

  static assertValidConfig(config: ZohoSignServiceConfig) {
    assertValidZohoConfig(config.zohoSign);
  }
}
