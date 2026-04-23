import { type ZohoDeskConfig, type ZohoDeskFactoryConfig } from '@dereekb/zoho';
import { assertValidZohoConfig } from '../zoho.config';

/**
 * API configuration for connecting to the Zoho Desk service endpoint.
 */
export type ZohoDeskServiceApiConfig = ZohoDeskConfig;

/**
 * Abstract configuration class for the NestJS Zoho Desk service.
 *
 * Used as a DI token so that applications can provide their own config values
 * while keeping the expected shape consistent.
 */
export abstract class ZohoDeskServiceConfig {
  /**
   * Zoho Desk API connection settings (endpoint URL, org ID, etc.).
   */
  readonly zohoDesk!: ZohoDeskServiceApiConfig;
  /**
   * Optional factory-level overrides applied when creating the underlying Desk client.
   */
  readonly factoryConfig?: ZohoDeskFactoryConfig;

  /**
   * Validates that the required Zoho Desk connection fields are present and well-formed.
   *
   * @param config - the Desk service config to validate
   */
  static assertValidConfig(config: ZohoDeskServiceConfig) {
    assertValidZohoConfig(config.zohoDesk);

    if (!config.zohoDesk.orgId) {
      throw new Error('No Zoho Desk orgId specified.');
    }
  }
}
