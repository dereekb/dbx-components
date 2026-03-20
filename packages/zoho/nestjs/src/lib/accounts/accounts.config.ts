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

/**
 * Input configuration for {@link zohoAccountsServiceConfigFromConfigService}.
 *
 * Requires a NestJS `ConfigService` instance (typically populated from environment variables)
 * and a `serviceAccessTokenKey` that identifies which Zoho service (e.g. `'crm'` or `'recruit'`)
 * is being configured. The key is used to derive service-specific environment variable names.
 */
export type ZohoAccountsServiceConfigFromConfigServiceInput = ZohoConfigServiceReaderConfig;

/**
 * Builds a {@link ZohoAccountsServiceConfig} by reading Zoho Accounts OAuth credentials
 * from a NestJS `ConfigService` (typically backed by environment variables).
 *
 * ## Environment Variable Resolution
 *
 * For each credential, the function first looks for a **service-specific** environment variable
 * (e.g. `ZOHO_CRM_ACCOUNTS_URL`), then falls back to the **shared** variable
 * (e.g. `ZOHO_ACCOUNTS_URL`). The service prefix is derived from `serviceAccessTokenKey`
 * uppercased (e.g. `'crm'` → `ZOHO_CRM_`, `'recruit'` → `ZOHO_RECRUIT_`).
 *
 * | Credential       | Shared env var                | Service-specific env var (example: CRM)      |
 * |------------------|-------------------------------|----------------------------------------------|
 * | Accounts API URL | `ZOHO_ACCOUNTS_URL`           | `ZOHO_CRM_ACCOUNTS_URL`                      |
 * | Refresh Token    | `ZOHO_ACCOUNTS_REFRESH_TOKEN` | `ZOHO_CRM_ACCOUNTS_REFRESH_TOKEN`            |
 * | Client ID        | `ZOHO_ACCOUNTS_CLIENT_ID`     | `ZOHO_CRM_ACCOUNTS_CLIENT_ID`                |
 * | Client Secret    | `ZOHO_ACCOUNTS_CLIENT_SECRET` | `ZOHO_CRM_ACCOUNTS_CLIENT_SECRET`            |
 *
 * When using Zoho Recruit, replace `CRM` with `RECRUIT` in the service-specific variable names.
 *
 * @param input - The {@link ZohoAccountsServiceConfigFromConfigServiceInput} containing the
 *   `ConfigService` and the `serviceAccessTokenKey` for the target Zoho service.
 * @returns A validated {@link ZohoAccountsServiceConfig} ready for use with `ZohoAccountsApi`.
 * @throws If any required credential (apiUrl, refreshToken, clientId) is missing.
 */
export function zohoAccountsServiceConfigFromConfigService(input: ZohoAccountsServiceConfigFromConfigServiceInput): ZohoAccountsServiceConfig {
  const { serviceAccessTokenKey } = input;
  const getFromConfigService = zohoConfigServiceReaderFunction(input);

  const zohoAccounts: ZohoAccountsServiceConfig['zohoAccounts'] = {
    serviceAccessTokenKey,
    apiUrl: getFromConfigService('ACCOUNTS_URL'), // ZOHO_<SERVICE>_ACCOUNTS_URL, ZOHO_ACCOUNTS_URL
    refreshToken: getFromConfigService('ACCOUNTS_REFRESH_TOKEN'), // ZOHO_<SERVICE>_ACCOUNTS_REFRESH_TOKEN, ZOHO_ACCOUNTS_REFRESH_TOKEN
    clientId: getFromConfigService('ACCOUNTS_CLIENT_ID'), // ZOHO_<SERVICE>_ACCOUNTS_CLIENT_ID, ZOHO_ACCOUNTS_CLIENT_ID
    clientSecret: getFromConfigService('ACCOUNTS_CLIENT_SECRET') // ZOHO_<SERVICE>_ACCOUNTS_CLIENT_SECRET, ZOHO_ACCOUNTS_CLIENT_SECRET
  };

  const config: ZohoAccountsServiceConfig = {
    zohoAccounts
  };

  ZohoAccountsServiceConfig.assertValidConfig(config);
  return config;
}
