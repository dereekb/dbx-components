import { type ZohoAccountsConfigApiUrlInput, type ZohoAccountsOAuthClientFactoryConfig, type ZohoOAuthClientId, type ZohoOAuthClientSecret } from '@dereekb/zoho';
import { type Maybe } from '@dereekb/util';
import { type ConfigService } from '@nestjs/config';

/**
 * Environment key naming the Zoho Accounts datacenter (or a full accounts URL) to authorize against.
 */
export const ZOHO_ACCOUNTS_URL_CONFIG_KEY = 'ZOHO_ACCOUNTS_URL';

/**
 * Environment key holding the Zoho OAuth client id.
 */
export const ZOHO_ACCOUNTS_CLIENT_ID_CONFIG_KEY = 'ZOHO_ACCOUNTS_CLIENT_ID';

/**
 * Environment key holding the Zoho OAuth client secret.
 */
export const ZOHO_ACCOUNTS_CLIENT_SECRET_CONFIG_KEY = 'ZOHO_ACCOUNTS_CLIENT_SECRET';

export interface ZohoAccountsOAuthServiceApiConfig {
  readonly clientId?: Maybe<ZohoOAuthClientId>;
  readonly clientSecret?: Maybe<ZohoOAuthClientSecret>;
  /**
   * The datacenter (or full accounts URL) to authorize and exchange against. Defaults to `us`.
   */
  readonly apiUrl?: Maybe<ZohoAccountsConfigApiUrlInput>;
}

/**
 * Configuration for {@link ZohoAccountsOAuthApi}.
 *
 * Read from the three existing flat `ZOHO_ACCOUNTS_*` keys rather than composed through
 * `zohoConfigServiceReaderFunction`, which requires a `serviceAccessTokenKey` a per-user OAuth
 * client does not have. Notably absent: `ZOHO_ACCOUNTS_REFRESH_TOKEN` (a per-user flow has no
 * server refresh token) and any scope variable (scopes are declared in code).
 */
export abstract class ZohoAccountsOAuthServiceConfig {
  readonly zohoAccountsOAuth!: ZohoAccountsOAuthServiceApiConfig;
  readonly factoryConfig?: ZohoAccountsOAuthClientFactoryConfig;

  static assertValidConfig(config: ZohoAccountsOAuthServiceConfig) {
    const { zohoAccountsOAuth } = config;

    if (!zohoAccountsOAuth) {
      throw new Error('ZohoAccountsOAuthServiceConfig.zohoAccountsOAuth is required');
    }

    if (!zohoAccountsOAuth.clientId) {
      throw new Error(`ZohoAccountsOAuthServiceConfig requires a clientId (${ZOHO_ACCOUNTS_CLIENT_ID_CONFIG_KEY}).`);
    }

    if (!zohoAccountsOAuth.clientSecret) {
      throw new Error(`ZohoAccountsOAuthServiceConfig requires a clientSecret (${ZOHO_ACCOUNTS_CLIENT_SECRET_CONFIG_KEY}).`);
    }
  }
}

/**
 * Factory function that creates a {@link ZohoAccountsOAuthServiceConfig} from NestJS ConfigService
 * environment variables.
 *
 * @param configService - The NestJS ConfigService instance.
 * @returns A validated ZohoAccountsOAuthServiceConfig.
 * @throws {Error} When the client id or client secret is not configured.
 */
export function zohoAccountsOAuthServiceConfigFactory(configService: ConfigService): ZohoAccountsOAuthServiceConfig {
  const clientId = configService.get<string>(ZOHO_ACCOUNTS_CLIENT_ID_CONFIG_KEY);
  const clientSecret = configService.get<string>(ZOHO_ACCOUNTS_CLIENT_SECRET_CONFIG_KEY);
  const apiUrl = configService.get<string>(ZOHO_ACCOUNTS_URL_CONFIG_KEY);

  const config: ZohoAccountsOAuthServiceConfig = {
    zohoAccountsOAuth: {
      clientId: clientId || undefined,
      clientSecret: clientSecret || undefined,
      apiUrl: apiUrl || undefined
    }
  };

  ZohoAccountsOAuthServiceConfig.assertValidConfig(config);
  return config;
}
