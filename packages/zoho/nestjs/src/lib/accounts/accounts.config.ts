import { type ZohoAccountsConfig, type ZohoAccountsFactoryConfig, type ZohoServiceAccessTokenKey } from '@dereekb/zoho';
import { type ZohoConfigServiceReaderConfig, zohoConfigServiceReaderFunction } from '../zoho.config';

export interface ZohoAccountsServiceApiConfig extends ZohoAccountsConfig {
  readonly serviceAccessTokenKey: ZohoServiceAccessTokenKey;
}

/**
 * Configuration for ZohoService
 */
export abstract class ZohoAccountsServiceConfig {
  readonly zohoAccounts!: ZohoAccountsServiceApiConfig;
  readonly factoryConfig?: ZohoAccountsFactoryConfig;

  static assertValidConfig(config: ZohoAccountsServiceConfig) {
    const { zohoAccounts } = config;

    if (!zohoAccounts) {
      throw new Error('ZohoAccountsServiceConfig.zohoAccounts is required');
    } else {
      if (!zohoAccounts.serviceAccessTokenKey) {
        throw new Error('ZohoAccountsServiceConfig.zohoAccounts.serviceAccessTokenKey is required');
      } else if (!zohoAccounts.refreshToken) {
        throw new Error('ZohoAccountsServiceConfig.zohoAccounts.refreshToken is required');
      } else if (!zohoAccounts.apiUrl) {
        throw new Error('ZohoAccountsServiceConfig.zohoAccounts.apiUrl is required');
      } else if (!zohoAccounts.clientId) {
        throw new Error('ZohoAccountsServiceConfig.zohoAccounts.clientId is required');
      }
    }
  }
}

export type ZohoAccountsServiceConfigFromConfigServiceInput = ZohoConfigServiceReaderConfig;

export function zohoAccountsServiceConfigFromConfigService(input: ZohoAccountsServiceConfigFromConfigServiceInput): ZohoAccountsServiceConfig {
  const { serviceAccessTokenKey } = input;
  const getFromConfigService = zohoConfigServiceReaderFunction(input);

  const zohoAccounts: ZohoAccountsServiceConfig['zohoAccounts'] = {
    serviceAccessTokenKey,
    apiUrl: getFromConfigService('ACCOUNTS_URL'), // ZOHO_ACCOUNTS_URL, ZOHO_RECRUIT_ACCOUNTS_URL
    refreshToken: getFromConfigService('ACCOUNTS_REFRESH_TOKEN'), // ZOHO_ACCOUNTS_REFRESH_TOKEN, ZOHO_RECRUIT_ACCOUNTS_REFRESH_TOKEN
    clientId: getFromConfigService('ACCOUNTS_CLIENT_ID'), // ZOHO_ACCOUNTS_CLIENT_ID, ZOHO_RECRUIT_ACCOUNTS_CLIENT_ID
    clientSecret: getFromConfigService('ACCOUNTS_CLIENT_SECRET') // ZOHO_ACCOUNTS_CLIENT_SECRET, ZOHO_RECRUIT_ACCOUNTS_CLIENT_SECRET
  };

  const config: ZohoAccountsServiceConfig = {
    zohoAccounts
  };

  ZohoAccountsServiceConfig.assertValidConfig(config);
  return config;
}
