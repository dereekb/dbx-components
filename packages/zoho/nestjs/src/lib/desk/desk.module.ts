import { type ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ZohoDeskApi } from './desk.api';
import { ZohoDeskServiceConfig } from './desk.config';
import { ZOHO_API_URL_CONFIG_KEY, zohoConfigServiceReaderFunction } from '../zoho.config';
import { ZohoAccountsApi } from '../accounts/accounts.api';
import { ZohoAccountsServiceConfig, zohoAccountsServiceConfigFromConfigService } from '../accounts/accounts.config';
import { ZOHO_DESK_SERVICE_NAME } from '@dereekb/zoho';
import { type Maybe } from '@dereekb/util';

/**
 * Config key suffix for the Zoho Desk organization ID.
 * Resolves to `ZOHO_DESK_ORG_ID` or `ZOHO_ORG_ID`.
 */
export const ZOHO_ORG_ID_CONFIG_KEY = 'ORG_ID';

// MARK: Provider Factories
/**
 * Reads Zoho Desk connection settings from the NestJS ConfigService
 * and returns a validated service config.
 *
 * Resolves the API URL via environment variables following the naming convention
 * `ZOHO_DESK_API_URL` (service-specific) or `ZOHO_API_URL` (shared fallback).
 * The organization ID is read from `ZOHO_DESK_ORG_ID` or `ZOHO_ORG_ID`.
 *
 * @param configService - NestJS config service populated with Zoho environment variables
 * @returns Validated Zoho Desk service configuration
 * @throws {Error} If required config values (API URL or orgId) are missing
 */
export function zohoDeskServiceConfigFactory(configService: ConfigService): ZohoDeskServiceConfig {
  const getFromConfigService = zohoConfigServiceReaderFunction(ZOHO_DESK_SERVICE_NAME, configService);

  const config: ZohoDeskServiceConfig = {
    zohoDesk: {
      apiUrl: getFromConfigService(ZOHO_API_URL_CONFIG_KEY),
      orgId: getFromConfigService(ZOHO_ORG_ID_CONFIG_KEY)
    }
  };

  ZohoDeskServiceConfig.assertValidConfig(config);
  return config;
}

/**
 * Reads Zoho Accounts (OAuth) settings scoped to the Desk service from
 * the NestJS ConfigService and returns an accounts service config.
 *
 * @param configService - NestJS config service populated with Zoho OAuth environment variables
 * @returns Zoho Accounts service config scoped to the Desk service access token
 */
export function zohoDeskAccountServiceConfigFactory(configService: ConfigService): ZohoAccountsServiceConfig {
  return zohoAccountsServiceConfigFromConfigService({
    configService,
    serviceAccessTokenKey: ZOHO_DESK_SERVICE_NAME
  });
}

// MARK: App Zoho Desk Module
/**
 * Configuration for generating the application-level Zoho Desk NestJS module metadata.
 *
 * Extends standard NestJS {@link ModuleMetadata} fields (`imports`, `exports`, `providers`)
 * so additional providers or modules can be merged into the generated metadata.
 */
export interface ProvideAppZohoDeskMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Module that exports the required dependencies for this module.
   * When provided, this module is automatically included in the generated `imports` array.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
}

/**
 * Generates NestJS {@link ModuleMetadata} that wires up the full Zoho Desk stack
 * (config, accounts, and API service) so consuming modules only need a single import.
 *
 * The generated module requires the following dependencies in order to initialize properly:
 * - {@link ZohoAccountsAccessTokenCacheService}
 *
 * Use the `dependencyModule` config option to import a module that exports those dependencies.
 *
 * The returned metadata registers {@link ZohoDeskServiceConfig}, {@link ZohoDeskApi},
 * {@link ZohoAccountsServiceConfig}, and {@link ZohoAccountsApi} as providers, and
 * exports {@link ZohoDeskApi} by default. Additional imports, exports, and providers
 * from the config are merged in.
 *
 * @param config - Module configuration with optional dependency module and extra metadata
 * @returns Complete NestJS module metadata ready to pass to `@Module()`
 */
export function appZohoDeskModuleMetadata(config: ProvideAppZohoDeskMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = config;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    exports: [ZohoDeskApi, ...(exports ?? [])],
    providers: [
      {
        provide: ZohoDeskServiceConfig,
        inject: [ConfigService],
        useFactory: zohoDeskServiceConfigFactory
      },
      ZohoDeskApi,
      // Accounts
      {
        provide: ZohoAccountsServiceConfig,
        inject: [ConfigService],
        useFactory: zohoDeskAccountServiceConfigFactory
      },
      ZohoAccountsApi,
      ...(providers ?? [])
    ]
  };
}
