import { type ZohoCrmConfig, type ZohoCrmFactoryConfig } from '@dereekb/zoho';
import { assertValidZohoConfig } from '../zoho.config';

/**
 * API configuration for connecting to the Zoho CRM service endpoint.
 */
export type ZohoCrmServiceApiConfig = ZohoCrmConfig & {};

/**
 * Abstract configuration class for the NestJS Zoho CRM service.
 *
 * Used as a DI token so that applications can provide their own config values
 * while keeping the expected shape consistent.
 */
export abstract class ZohoCrmServiceConfig {
  /**
   * Zoho CRM API connection settings (endpoint URL, etc.).
   */
  readonly zohoCrm!: ZohoCrmServiceApiConfig;
  /**
   * Optional factory-level overrides applied when creating the underlying CRM client.
   */
  readonly factoryConfig?: ZohoCrmFactoryConfig;

  /**
   * Validates that the required Zoho CRM connection fields are present and well-formed.
   *
   * @param config - the CRM service config to validate
   */
  static assertValidConfig(config: ZohoCrmServiceConfig) {
    assertValidZohoConfig(config.zohoCrm);
  }
}
