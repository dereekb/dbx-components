import { type ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ZohoSignApi } from './sign.api';
import { ZohoSignServiceConfig } from './sign.config';
import { ZOHO_API_URL_CONFIG_KEY, zohoConfigServiceReaderFunction } from '../zoho.config';
import { ZohoAccountsApi } from '../accounts/accounts.api';
import { ZohoAccountsServiceConfig, zohoAccountsServiceConfigFromConfigService } from '../accounts/accounts.config';
import { ZOHO_SIGN_SERVICE_NAME } from '@dereekb/zoho';
import { type Maybe } from '@dereekb/util';

// MARK: Provider Factories
/**
 * Reads Zoho Sign connection settings from the NestJS ConfigService
 * and returns a validated service config.
 *
 * Resolves the API URL via environment variables following the naming convention
 * `ZOHO_SIGN_API_URL` (service-specific) or `ZOHO_API_URL` (shared fallback).
 *
 * @param configService - NestJS config service populated with Zoho environment variables
 * @returns Validated Zoho Sign service configuration
 * @throws {Error} If required config values (e.g. API URL) are missing
 *
 * @example
 * ```typescript
 * // Typically used as a NestJS factory provider:
 * {
 *   provide: ZohoSignServiceConfig,
 *   inject: [ConfigService],
 *   useFactory: zohoSignServiceConfigFactory
 * }
 * ```
 */
export function zohoSignServiceConfigFactory(configService: ConfigService): ZohoSignServiceConfig {
  const getFromConfigService = zohoConfigServiceReaderFunction(ZOHO_SIGN_SERVICE_NAME, configService);

  const config: ZohoSignServiceConfig = {
    zohoSign: {
      apiUrl: getFromConfigService(ZOHO_API_URL_CONFIG_KEY)
    }
  };

  ZohoSignServiceConfig.assertValidConfig(config);
  return config;
}

/**
 * Reads Zoho Accounts (OAuth) settings scoped to the Sign service from
 * the NestJS ConfigService and returns an accounts service config.
 *
 * @param configService - NestJS config service populated with Zoho OAuth environment variables
 * @returns Zoho Accounts service config scoped to the Sign service access token
 *
 * @example
 * ```typescript
 * {
 *   provide: ZohoAccountsServiceConfig,
 *   inject: [ConfigService],
 *   useFactory: zohoSignAccountServiceConfigFactory
 * }
 * ```
 */
export function zohoSignAccountServiceConfigFactory(configService: ConfigService): ZohoAccountsServiceConfig {
  return zohoAccountsServiceConfigFromConfigService({
    configService,
    serviceAccessTokenKey: ZOHO_SIGN_SERVICE_NAME
  });
}

// MARK: App Zoho Sign Module
/**
 * Configuration for generating the application-level Zoho Sign NestJS module metadata.
 *
 * Extends standard NestJS {@link ModuleMetadata} fields (`imports`, `exports`, `providers`)
 * so additional providers or modules can be merged into the generated metadata.
 */
export interface ProvideAppZohoSignMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Module that exports the required dependencies for this module.
   * When provided, this module is automatically included in the generated `imports` array.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
}

/**
 * Generates NestJS {@link ModuleMetadata} that wires up the full Zoho Sign stack
 * (config, accounts, and API service) so consuming modules only need a single import.
 *
 * The generated module requires the following dependencies in order to initialize properly:
 * - {@link ZohoAccountsAccessTokenCacheService}
 *
 * Use the `dependencyModule` config option to import a module that exports those dependencies.
 *
 * The returned metadata registers {@link ZohoSignServiceConfig}, {@link ZohoSignApi},
 * {@link ZohoAccountsServiceConfig}, and {@link ZohoAccountsApi} as providers, and
 * exports {@link ZohoSignApi} by default. Additional imports, exports, and providers
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
 * export class ZohoSignDependencyModule {}
 *
 * @Module(appZohoSignModuleMetadata({ dependencyModule: ZohoSignDependencyModule }))
 * export class AppZohoSignModule {}
 * ```
 */
export function appZohoSignModuleMetadata(config: ProvideAppZohoSignMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = config;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    exports: [ZohoSignApi, ...(exports ?? [])],
    providers: [
      {
        provide: ZohoSignServiceConfig,
        inject: [ConfigService],
        useFactory: zohoSignServiceConfigFactory
      },
      ZohoSignApi,
      // Accounts
      {
        provide: ZohoAccountsServiceConfig,
        inject: [ConfigService],
        useFactory: zohoSignAccountServiceConfigFactory
      },
      ZohoAccountsApi,
      ...(providers ?? [])
    ]
  };
}
