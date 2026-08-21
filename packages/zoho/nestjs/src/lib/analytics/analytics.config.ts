import { type ZohoAnalyticsConfig, type ZohoAnalyticsFactoryConfig } from '@dereekb/zoho';
import { assertValidZohoConfig } from '../zoho.config';

/**
 * Zoho Analytics API configuration for the {@link ZohoAnalyticsApi}.
 */
export type ZohoAnalyticsServiceApiConfig = ZohoAnalyticsConfig;

/**
 * Configuration for the Zoho Analytics service, used as the injection token for the
 * {@link ZohoAnalyticsApi}.
 */
export abstract class ZohoAnalyticsServiceConfig {
  readonly zohoAnalytics!: ZohoAnalyticsServiceApiConfig;
  readonly factoryConfig?: ZohoAnalyticsFactoryConfig;

  /**
   * Asserts the config carries everything needed to reach the Zoho Analytics API.
   *
   * Unlike Zoho Desk, the organization id is not required here: `GET /orgs` is the bootstrap call
   * that discovers it, and is the one endpoint that works without it. Every other endpoint fails
   * with error code 8083 when `orgId` is absent.
   *
   * @param config - The config to validate.
   * @throws {Error} When the API URL is missing.
   */
  static assertValidConfig(config: ZohoAnalyticsServiceConfig) {
    assertValidZohoConfig(config.zohoAnalytics);
  }
}
