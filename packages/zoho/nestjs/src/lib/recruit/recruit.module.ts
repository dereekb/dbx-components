import { type ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ZohoRecruitApi } from './recruit.api';
import { ZohoRecruitServiceConfig } from './recruit.config';
import { ZOHO_API_URL_CONFIG_KEY, zohoConfigServiceReaderFunction } from '../zoho.config';
import { ZohoAccountsApi } from '../accounts/accounts.api';
import { ZohoAccountsServiceConfig, zohoAccountsServiceConfigFromConfigService } from '../accounts/accounts.config';
import { ZOHO_RECRUIT_SERVICE_NAME } from '@dereekb/zoho';
import { type Maybe } from '@dereekb/util';

// MARK: Provider Factories
/**
 * Reads Zoho Recruit connection settings from the NestJS ConfigService
 * and returns a validated service config.
 *
 * Resolves the API URL via environment variables following the naming convention
 * `ZOHO_RECRUIT_API_URL` (service-specific) or `ZOHO_API_URL` (shared fallback).
 *
 * @param configService - NestJS config service populated with Zoho environment variables
 * @returns Validated Zoho Recruit service configuration
 * @throws {Error} If required config values (e.g. API URL) are missing
 *
 * @example
 * ```typescript
 * {
 *   provide: ZohoRecruitServiceConfig,
 *   inject: [ConfigService],
 *   useFactory: zohoRecruitServiceConfigFactory
 * }
 * ```
 */
export function zohoRecruitServiceConfigFactory(configService: ConfigService): ZohoRecruitServiceConfig {
  const getFromConfigService = zohoConfigServiceReaderFunction(ZOHO_RECRUIT_SERVICE_NAME, configService);

  const config: ZohoRecruitServiceConfig = {
    zohoRecruit: {
      apiUrl: getFromConfigService(ZOHO_API_URL_CONFIG_KEY)
    }
  };

  ZohoRecruitServiceConfig.assertValidConfig(config);
  return config;
}

/**
 * Reads Zoho Accounts (OAuth) settings scoped to the Recruit service from
 * the NestJS ConfigService and returns an accounts service config.
 *
 * @param configService - NestJS config service populated with Zoho OAuth environment variables
 * @returns Zoho Accounts service config scoped to the Recruit service access token
 *
 * @example
 * ```typescript
 * {
 *   provide: ZohoAccountsServiceConfig,
 *   inject: [ConfigService],
 *   useFactory: zohoRecruitAccountServiceConfigFactory
 * }
 * ```
 */
export function zohoRecruitAccountServiceConfigFactory(configService: ConfigService): ZohoAccountsServiceConfig {
  return zohoAccountsServiceConfigFromConfigService({
    configService,
    serviceAccessTokenKey: ZOHO_RECRUIT_SERVICE_NAME
  });
}

// MARK: App Zoho Recruit Module
/**
 * Configuration for generating the application-level Zoho Recruit NestJS module metadata.
 *
 * Extends standard NestJS {@link ModuleMetadata} fields (`imports`, `exports`, `providers`)
 * so additional providers or modules can be merged into the generated metadata.
 */
export interface ProvideAppZohoRecruitMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Module that exports the required dependencies for this module.
   * When provided, this module is automatically included in the generated `imports` array.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
}

/**
 * Generates NestJS {@link ModuleMetadata} that wires up the full Zoho Recruit stack
 * (config, accounts, and API service) so consuming modules only need a single import.
 *
 * The generated module requires the following dependencies in order to initialize properly:
 * - {@link ZohoAccountsAccessTokenCacheService}
 *
 * Use the `dependencyModule` config option to import a module that exports those dependencies.
 *
 * The returned metadata registers {@link ZohoRecruitServiceConfig}, {@link ZohoRecruitApi},
 * {@link ZohoAccountsServiceConfig}, and {@link ZohoAccountsApi} as providers, and
 * exports {@link ZohoRecruitApi} by default. Additional imports, exports, and providers
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
 * export class ZohoRecruitDependencyModule {}
 *
 * @Module(appZohoRecruitModuleMetadata({ dependencyModule: ZohoRecruitDependencyModule }))
 * export class AppZohoRecruitModule {}
 * ```
 */
export function appZohoRecruitModuleMetadata(config: ProvideAppZohoRecruitMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = config;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    exports: [ZohoRecruitApi, ...(exports ?? [])],
    providers: [
      {
        provide: ZohoRecruitServiceConfig,
        inject: [ConfigService],
        useFactory: zohoRecruitServiceConfigFactory
      },
      ZohoRecruitApi,
      // Accounts
      {
        provide: ZohoAccountsServiceConfig,
        inject: [ConfigService],
        useFactory: zohoRecruitAccountServiceConfigFactory
      },
      ZohoAccountsApi,
      ...(providers ?? [])
    ]
  };
}
