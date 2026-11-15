import { assertMicrosoftSingleTenantId, type MicrosoftEntraTenantId, type MicrosoftOAuthClientId, type MicrosoftOAuthClientSecret, type MicrosoftOAuthConfig, type MicrosoftOAuthFactoryConfig } from '@dereekb/microsoft';
import { type ConfigService } from '@nestjs/config';

export const MICROSOFT_OAUTH_CLIENT_ID_CONFIG_KEY = 'MICROSOFT_OAUTH_CLIENT_ID';
export const MICROSOFT_OAUTH_CLIENT_SECRET_CONFIG_KEY = 'MICROSOFT_OAUTH_CLIENT_SECRET';
export const MICROSOFT_OAUTH_TENANT_CONFIG_KEY = 'MICROSOFT_OAUTH_TENANT';

/**
 * The environment-facing shape of the Microsoft OAuth client credentials.
 *
 * Every value is optional here, mirroring the `MICROSOFT_OAUTH_*` variables they are read from, so a
 * missing variable is reported by {@link MicrosoftOAuthServiceConfig.assertValidConfig}.
 */
export interface MicrosoftOAuthServiceApiConfig {
  readonly tenantId?: MicrosoftEntraTenantId;
  readonly clientId?: MicrosoftOAuthClientId;
  readonly clientSecret?: MicrosoftOAuthClientSecret;
}

/**
 * Configuration for the {@link MicrosoftOAuthApi}: one single-tenant Entra app registration.
 */
export abstract class MicrosoftOAuthServiceConfig {
  readonly microsoftOAuth!: MicrosoftOAuthServiceApiConfig;
  /**
   * Optional configuration for the OAuth client the api builds — a custom fetch handler or error logger.
   */
  readonly factoryConfig?: MicrosoftOAuthFactoryConfig;

  static assertValidConfig(config: MicrosoftOAuthServiceConfig) {
    const { microsoftOAuth } = config;

    if (!microsoftOAuth) {
      throw new Error('MicrosoftOAuthServiceConfig.microsoftOAuth is required');
    } else if (!microsoftOAuth.clientId) {
      throw new Error(`MicrosoftOAuthServiceConfig requires a Microsoft OAuth client id (${MICROSOFT_OAUTH_CLIENT_ID_CONFIG_KEY}).`);
    } else if (!microsoftOAuth.clientSecret) {
      throw new Error(`MicrosoftOAuthServiceConfig requires a Microsoft OAuth client secret (${MICROSOFT_OAUTH_CLIENT_SECRET_CONFIG_KEY}).`);
    } else if (!microsoftOAuth.tenantId) {
      throw new Error(`MicrosoftOAuthServiceConfig requires a single Microsoft Entra tenant id (${MICROSOFT_OAUTH_TENANT_CONFIG_KEY}).`);
    }

    // refuses common / organizations / consumers at boot rather than at the consent screen
    assertMicrosoftSingleTenantId(microsoftOAuth.tenantId);
  }

  /**
   * Narrows the environment-facing config to the fully-populated {@link MicrosoftOAuthConfig}.
   *
   * @param config - The service configuration to read.
   * @returns The validated OAuth client configuration.
   * @throws {Error} When a value is missing or the tenant is multi-tenant.
   */
  static assertedMicrosoftOAuthConfig(config: MicrosoftOAuthServiceConfig): MicrosoftOAuthConfig {
    MicrosoftOAuthServiceConfig.assertValidConfig(config);
    const { tenantId, clientId, clientSecret } = config.microsoftOAuth;
    return { tenantId: assertMicrosoftSingleTenantId(tenantId), clientId: clientId as MicrosoftOAuthClientId, clientSecret: clientSecret as MicrosoftOAuthClientSecret };
  }
}

/**
 * Creates a {@link MicrosoftOAuthServiceConfig} from the `MICROSOFT_OAUTH_CLIENT_ID`,
 * `MICROSOFT_OAUTH_CLIENT_SECRET` and `MICROSOFT_OAUTH_TENANT` environment variables.
 *
 * @param configService - The NestJS ConfigService instance.
 * @returns A validated MicrosoftOAuthServiceConfig.
 * @throws {Error} When a value is missing or the tenant is multi-tenant.
 */
export function microsoftOAuthServiceConfigFactory(configService: ConfigService): MicrosoftOAuthServiceConfig {
  const config: MicrosoftOAuthServiceConfig = {
    microsoftOAuth: {
      tenantId: configService.get<string>(MICROSOFT_OAUTH_TENANT_CONFIG_KEY) || undefined,
      clientId: configService.get<string>(MICROSOFT_OAUTH_CLIENT_ID_CONFIG_KEY) || undefined,
      clientSecret: configService.get<string>(MICROSOFT_OAUTH_CLIENT_SECRET_CONFIG_KEY) || undefined
    }
  };

  MicrosoftOAuthServiceConfig.assertValidConfig(config);
  return config;
}
