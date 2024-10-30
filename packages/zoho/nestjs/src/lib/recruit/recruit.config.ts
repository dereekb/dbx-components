import { ZohoRecruitConfig, ZohoRecruitFactoryConfig } from '@dereekb/zoho';

export type ZohoRecruitServiceApiConfig = ZohoRecruitConfig & {};

/**
 * Configuration for ZohoService
 */
export abstract class ZohoRecruitServiceConfig {
  zohoRecruit!: ZohoRecruitServiceApiConfig;
  factoryConfig?: ZohoRecruitFactoryConfig;

  static assertValidConfig(config: ZohoRecruitServiceConfig) {}
}
