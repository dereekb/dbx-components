import { type ZohoSignConfig, type ZohoSignFactoryConfig } from '@dereekb/zoho';
import { JwksServiceConfig } from './jwks';
import { JwksKeyConverterConfig } from './model';

/**
 * Configuration for ZohoSignService
 */
export abstract class OidcModuleConfig {
  readonly jwksServiceConfig!: JwksServiceConfig;
  readonly jwksKeyConverterConfig!: JwksKeyConverterConfig;

  // TODO: Configurations!

  static assertValidConfig(config: OidcModuleConfig) {
    // TODO: Validate
  }
}
