import { type ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ZohoAnalyticsApi } from './analytics.api';
import { ZohoAnalyticsServiceConfig } from './analytics.config';
import { ZOHO_API_URL_CONFIG_KEY, zohoConfigServiceReaderFunction } from '../zoho.config';
import { ZohoAccountsApi } from '../accounts/accounts.api';
import { ZohoAccountsServiceConfig, zohoAccountsServiceConfigFromConfigService } from '../accounts/accounts.config';
import { ZOHO_ANALYTICS_SERVICE_NAME } from '@dereekb/zoho';
import { type Maybe } from '@dereekb/util';

/**
 * Config key suffix for the Zoho Analytics organization ID.
 * Resolves to `ZOHO_ANALYTICS_ORG_ID` or `ZOHO_ORG_ID`.
 */
export const ZOHO_ANALYTICS_ORG_ID_CONFIG_KEY = 'ORG_ID';

// MARK: Provider Factories
/**
 * Reads Zoho Analytics connection settings from the NestJS ConfigService
 * and returns a validated service config.
 *
 * Resolves the API URL via environment variables following the naming convention
 * `ZOHO_ANALYTICS_API_URL` (service-specific) or `ZOHO_API_URL` (shared fallback).
 * The organization ID is read from `ZOHO_ANALYTICS_ORG_ID` or `ZOHO_ORG_ID`.
 *
 * The organization ID is optional: without it only `getOrgs()` succeeds, which is how the id is
 * discovered in the first place.
 *
 * @param configService - NestJS config service populated with Zoho environment variables.
 * @returns Validated Zoho Analytics service configuration.
 * @throws {Error} If the API URL is missing.
 */
export function zohoAnalyticsServiceConfigFactory(configService: ConfigService): ZohoAnalyticsServiceConfig {
  const getFromConfigService = zohoConfigServiceReaderFunction(ZOHO_ANALYTICS_SERVICE_NAME, configService);

  const config: ZohoAnalyticsServiceConfig = {
    zohoAnalytics: {
      apiUrl: getFromConfigService(ZOHO_API_URL_CONFIG_KEY),
      orgId: getFromConfigService(ZOHO_ANALYTICS_ORG_ID_CONFIG_KEY)
    }
  };

  ZohoAnalyticsServiceConfig.assertValidConfig(config);
  return config;
}

/**
 * Reads Zoho Accounts (OAuth) settings scoped to the Analytics service from
 * the NestJS ConfigService and returns an accounts service config.
 *
 * @param configService - NestJS config service populated with Zoho OAuth environment variables.
 * @returns Zoho Accounts service config scoped to the Analytics service access token.
 */
export function zohoAnalyticsAccountServiceConfigFactory(configService: ConfigService): ZohoAccountsServiceConfig {
  return zohoAccountsServiceConfigFromConfigService({
    configService,
    serviceAccessTokenKey: ZOHO_ANALYTICS_SERVICE_NAME
  });
}

// MARK: App Zoho Analytics Module
/**
 * Configuration for generating the application-level Zoho Analytics NestJS module metadata.
 *
 * Extends standard NestJS {@link ModuleMetadata} fields (`imports`, `exports`, `providers`)
 * so additional providers or modules can be merged into the generated metadata.
 */
export interface ProvideAppZohoAnalyticsMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Module that exports the required dependencies for this module.
   * When provided, this module is automatically included in the generated `imports` array.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
}

/**
 * Generates NestJS {@link ModuleMetadata} that wires up the full Zoho Analytics stack
 * (config, accounts, and API service) so consuming modules only need a single import.
 *
 * The generated module requires the following dependencies in order to initialize properly:
 * - `ZohoAccountsAccessTokenCacheService`
 *
 * Use the `dependencyModule` config option to import a module that exports those dependencies.
 *
 * The returned metadata registers {@link ZohoAnalyticsServiceConfig}, {@link ZohoAnalyticsApi},
 * {@link ZohoAccountsServiceConfig}, and {@link ZohoAccountsApi} as providers, and
 * exports {@link ZohoAnalyticsApi} by default. Additional imports, exports, and providers
 * from the config are merged in.
 *
 * @param config - Module configuration with optional dependency module and extra metadata.
 * @returns Complete NestJS module metadata ready to pass to `@Module()`
 */
export function appZohoAnalyticsModuleMetadata(config: ProvideAppZohoAnalyticsMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = config;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    exports: [ZohoAnalyticsApi, ...(exports ?? [])],
    providers: [
      {
        provide: ZohoAnalyticsServiceConfig,
        inject: [ConfigService],
        useFactory: zohoAnalyticsServiceConfigFactory
      },
      ZohoAnalyticsApi,
      // Accounts
      {
        provide: ZohoAccountsServiceConfig,
        inject: [ConfigService],
        useFactory: zohoAnalyticsAccountServiceConfigFactory
      },
      ZohoAccountsApi,
      ...(providers ?? [])
    ]
  };
}
