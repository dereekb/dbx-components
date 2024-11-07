import { ZohoRecruitConfig, ZohoRecruitFactoryConfig } from '@dereekb/zoho';
import { assertValidZohoConfig } from '../zoho.config';

export type ZohoRecruitServiceApiConfig = ZohoRecruitConfig & {};

/**
 * Configuration for ZohoRecruitService
 */
export abstract class ZohoRecruitServiceConfig {
  readonly zohoRecruit!: ZohoRecruitServiceApiConfig;
  readonly factoryConfig?: ZohoRecruitFactoryConfig;

  static assertValidConfig(config: ZohoRecruitServiceConfig) {
    assertValidZohoConfig(config.zohoRecruit);
  }
}
