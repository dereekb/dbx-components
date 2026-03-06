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
 */
export interface ProvideAppZohoCrmMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * The ZohoCrmModule requires the following dependencies in order to initialze properly:
   * - ZohoAccountsAccessTokenCacheService
   *
   * This module declaration makes it easier to import a module that exports those depenendencies.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
}

/**
 * Generates NestJS ModuleMetadata that wires up the full Zoho CRM stack
 * (config, accounts, and API service) so consuming modules only need a
 * single import. Allows merging additional imports, exports, and providers.
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
