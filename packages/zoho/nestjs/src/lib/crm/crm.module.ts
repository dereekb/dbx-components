import { type ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ZohoCrmApi } from './crm.api';
import { ZohoCrmServiceConfig } from './crm.config';
import { ZOHO_API_URL_CONFIG_KEY, zohoConfigServiceReaderFunction } from '../zoho.config';
import { ZohoAccountsApi } from '../accounts/accounts.api';
import { ZohoAccountsServiceConfig, zohoAccountsServiceConfigFromConfigService } from '../accounts/accounts.config';
import { ZOHO_CRM_SERVICE_NAME } from '@dereekb/zoho';
import { type Maybe } from '@dereekb/util';

// MARK: Provider Factories
/**
 * Reads Zoho CRM connection settings from the NestJS ConfigService
 * and returns a validated service config.
 *
 * Resolves the API URL via environment variables following the naming convention
 * `ZOHO_CRM_API_URL` (service-specific) or `ZOHO_API_URL` (shared fallback).
 *
 * @param configService - NestJS config service populated with Zoho environment variables
 * @returns Validated Zoho CRM service configuration
 * @throws {Error} If required config values (e.g. API URL) are missing
 *
 * @example
 * ```typescript
 * {
 *   provide: ZohoCrmServiceConfig,
 *   inject: [ConfigService],
 *   useFactory: zohoCrmServiceConfigFactory
 * }
 * ```
 */
export function zohoCrmServiceConfigFactory(configService: ConfigService): ZohoCrmServiceConfig {
  const getFromConfigService = zohoConfigServiceReaderFunction(ZOHO_CRM_SERVICE_NAME, configService);

  const config: ZohoCrmServiceConfig = {
    zohoCrm: {
      apiUrl: getFromConfigService(ZOHO_API_URL_CONFIG_KEY)
    }
  };

  ZohoCrmServiceConfig.assertValidConfig(config);
  return config;
}

/**
 * Reads Zoho Accounts (OAuth) settings scoped to the CRM service from
 * the NestJS ConfigService and returns an accounts service config.
 *
 * @param configService - NestJS config service populated with Zoho OAuth environment variables
 * @returns Zoho Accounts service config scoped to the CRM service access token
 *
 * @example
 * ```typescript
 * {
 *   provide: ZohoAccountsServiceConfig,
 *   inject: [ConfigService],
 *   useFactory: zohoCrmAccountServiceConfigFactory
 * }
 * ```
 */
export function zohoCrmAccountServiceConfigFactory(configService: ConfigService): ZohoAccountsServiceConfig {
  return zohoAccountsServiceConfigFromConfigService({
    configService,
    serviceAccessTokenKey: ZOHO_CRM_SERVICE_NAME
  });
}

// MARK: App Zoho Crm Module
/**
 * Configuration for generating the application-level Zoho CRM NestJS module metadata.
 *
 * Extends standard NestJS {@link ModuleMetadata} fields (`imports`, `exports`, `providers`)
 * so additional providers or modules can be merged into the generated metadata.
 */
export interface ProvideAppZohoCrmMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Module that exports the required dependencies for this module.
   * When provided, this module is automatically included in the generated `imports` array.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
}

/**
 * Generates NestJS {@link ModuleMetadata} that wires up the full Zoho CRM stack
 * (config, accounts, and API service) so consuming modules only need a single import.
 *
 * The generated module requires the following dependencies in order to initialize properly:
 * - {@link ZohoAccountsAccessTokenCacheService}
 *
 * Use the `dependencyModule` config option to import a module that exports those dependencies.
 *
 * The returned metadata registers {@link ZohoCrmServiceConfig}, {@link ZohoCrmApi},
 * {@link ZohoAccountsServiceConfig}, and {@link ZohoAccountsApi} as providers, and
 * exports {@link ZohoCrmApi} by default. Additional imports, exports, and providers
 * from the config are merged in.
 *
 * @param config - Module configuration with optional dependency module and extra metadata
 * @returns Complete NestJS module metadata ready to pass to `@Module()`
 *
 * @example
 * ```typescript
 * const cacheService = fileZohoAccountsAccessTokenCacheService();
 *
 * @Module({
 *   providers: [
 *     {
 *       provide: ZohoAccountsAccessTokenCacheService,
 *       useValue: cacheService
 *     }
 *   ],
 *   exports: [ZohoAccountsAccessTokenCacheService]
 * })
 * export class ZohoCrmDependencyModule {}
 *
 * @Module(appZohoCrmModuleMetadata({ dependencyModule: ZohoCrmDependencyModule }))
 * export class AppZohoCrmModule {}
 * ```
 */
export function appZohoCrmModuleMetadata(config: ProvideAppZohoCrmMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = config;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    exports: [ZohoCrmApi, ...(exports ?? [])],
    providers: [
      {
        provide: ZohoCrmServiceConfig,
        inject: [ConfigService],
        useFactory: zohoCrmServiceConfigFactory
      },
      ZohoCrmApi,
      // Accounts
      {
        provide: ZohoAccountsServiceConfig,
        inject: [ConfigService],
        useFactory: zohoCrmAccountServiceConfigFactory
      },
      ZohoAccountsApi,
      ...(providers ?? [])
    ]
  };
}
