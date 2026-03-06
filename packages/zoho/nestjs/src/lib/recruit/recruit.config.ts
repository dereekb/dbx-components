import { type ZohoRecruitConfig, type ZohoRecruitFactoryConfig } from '@dereekb/zoho';
import { assertValidZohoConfig } from '../zoho.config';

/**
 * API configuration for connecting to the Zoho Recruit service endpoint.
 */
export type ZohoRecruitServiceApiConfig = ZohoRecruitConfig & {};

/**
 * Abstract configuration class for the NestJS Zoho Recruit service.
 *
 * Used as a DI token so that applications can provide their own config values
 * while keeping the expected shape consistent.
 */
export abstract class ZohoRecruitServiceConfig {
  /**
   * Zoho Recruit API connection settings (endpoint URL, etc.).
   */
  readonly zohoRecruit!: ZohoRecruitServiceApiConfig;
  /**
   * Optional factory-level overrides applied when creating the underlying Recruit client.
   */
  readonly factoryConfig?: ZohoRecruitFactoryConfig;

  /**
   * Validates that the required Zoho Recruit connection fields are present and well-formed.
   */
  static assertValidConfig(config: ZohoRecruitServiceConfig) {
    assertValidZohoConfig(config.zohoRecruit);
  }
}
