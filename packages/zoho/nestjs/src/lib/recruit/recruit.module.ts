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
 */
export interface ProvideAppZohoRecruitMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * The ZohoRecruitModule requires the following dependencies in order to initialze properly:
   * - ZohoAccountsAccessTokenCacheService
   *
   * This module declaration makes it easier to import a module that exports those depenendencies.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
}

/**
 * Generates NestJS ModuleMetadata that wires up the full Zoho Recruit stack
 * (config, accounts, and API service) so consuming modules only need a
 * single import. Allows merging additional imports, exports, and providers.
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
